/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/layout/Sidebar.tsx';
import { Header } from './components/layout/Header.tsx';
import { DashboardPage } from './components/pages/DashboardPage.tsx';
import { SourcesPage } from './components/pages/SourcesPage.tsx';
import { EventsPage } from './components/pages/EventsPage.tsx';
import { DriftPage } from './components/pages/DriftPage.tsx';
import { OutputProfilesPage } from './components/pages/OutputProfilesPage.tsx';
import { DirectIngestPage } from './components/pages/DirectIngestPage.tsx';
import { SettingsPage } from './components/pages/SettingsPage.tsx';
import { VerificationModal } from './components/common/VerificationModal.tsx';
import { QuickActionPalette } from './components/common/QuickActionPalette.tsx';
import { KeyboardShortcutsModal } from './components/common/KeyboardShortcutsModal.tsx';
import { IngestLogsModal } from './components/common/IngestLogsModal.tsx';
import { ProcessedStreamEvent } from './types.ts';
import { streamSimulator, processRawEventThroughPipeline } from './services/streamSimulator.ts';
import { quarantineManager } from './services/quarantineManager.ts';
import { GOLDEN_CORPUS } from './data/goldenCorpus.ts';

export default function App() {
  const [currentRoute, setCurrentRoute] = useState<string>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState<boolean>(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState<boolean>(false);
  const [isIngestModalOpen, setIsIngestModalOpen] = useState<boolean>(false);
  const [isVerificationOpen, setIsVerificationOpen] = useState<boolean>(false);
  const [workbenchPayload, setWorkbenchPayload] = useState<string | undefined>(undefined);
  const [quarantinedCount, setQuarantinedCount] = useState<number>(0);

  // Live Stream & Events State (Populated with real pipeline-processed events)
  const [events, setEvents] = useState<ProcessedStreamEvent[]>(() => {
    return [
      GOLDEN_CORPUS[0]?.raw,
      GOLDEN_CORPUS[1]?.raw,
      GOLDEN_CORPUS[2]?.raw,
      GOLDEN_CORPUS[3]?.raw,
    ]
      .filter(Boolean)
      .map((raw) => processRawEventThroughPipeline(raw));
  });
  const [isStreamRunning, setIsStreamRunning] = useState<boolean>(false);
  const [latencies, setLatencies] = useState<number[]>([
    0.16, 0.19, 0.14, 0.22, 0.18, 0.15, 0.21, 0.17,
  ]);

  const avgLatencyMs =
    latencies.length > 0
      ? latencies.reduce((a, b) => a + b, 0) / latencies.length
      : 0.18;

  // Sync Quarantine count
  useEffect(() => {
    setQuarantinedCount(quarantineManager.getAll().length);
    const unsubscribe = quarantineManager.subscribe((list) => {
      setQuarantinedCount(list.length);
    });
    return () => unsubscribe();
  }, []);

  // Hook into stream simulator
  useEffect(() => {
    streamSimulator.setCallback((newEvent: ProcessedStreamEvent) => {
      setEvents((prev) => [newEvent, ...prev].slice(0, 300));
      setLatencies((prev) => [
        newEvent.latencyMs,
        ...prev.slice(0, 19),
      ]);
    });

    return () => {
      streamSimulator.setCallback(() => {});
    };
  }, []);

  const handleToggleStream = () => {
    if (isStreamRunning) {
      streamSimulator.stop();
      setIsStreamRunning(false);
    } else {
      streamSimulator.start(2);
      setIsStreamRunning(true);
    }
  };

  const handleInjectPulse = () => {
    const ev = streamSimulator.pulse();
    setEvents((prev) => [ev, ...prev].slice(0, 300));
  };

  const handleInjectSample = (raw: string) => {
    setWorkbenchPayload(raw);
    setCurrentRoute('sources');
  };

  // Global Keyboard Shortcuts (Section 64)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      // Space to toggle stream (when not typing in an input)
      if (e.code === 'Space' && !isInput) {
        e.preventDefault();
        handleToggleStream();
        return;
      }

      // Cmd+K / Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsPaletteOpen((prev) => !prev);
        return;
      }

      // Escape
      if (e.key === 'Escape') {
        if (isPaletteOpen) {
          setIsPaletteOpen(false);
          return;
        }
        if (isShortcutsOpen) {
          setIsShortcutsOpen(false);
          return;
        }
        if (isVerificationOpen) {
          setIsVerificationOpen(false);
          return;
        }
      }

      if (isInput) return;

      const keyRouteMap: Record<string, string> = {
        '1': 'dashboard',
        '2': 'sources',
        '3': 'events',
        '4': 'drift',
        '5': 'outputs',
        s: 'settings',
        S: 'settings',
      };

      if (keyRouteMap[e.key]) {
        e.preventDefault();
        setCurrentRoute(keyRouteMap[e.key]);
      } else if (e.key === '?') {
        e.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPaletteOpen, isShortcutsOpen, isVerificationOpen]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans antialiased flex">
      {/* Fixed Left Sidebar with 5 Core Pipeline Steps */}
      <Sidebar
        currentRoute={currentRoute}
        onNavigate={setCurrentRoute}
        quarantinedCount={quarantinedCount}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        onOpenVerification={() => setIsVerificationOpen(true)}
      />

      {/* Main App Canvas */}
      <div className="lg:pl-64 flex flex-col flex-1 min-h-screen w-full bg-zinc-950">
        {/* Top Sticky Header */}
        <Header
          currentRoute={currentRoute}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          onOpenShortcuts={() => setIsShortcutsOpen(true)}
          onOpenCommandPalette={() => setIsPaletteOpen(true)}
          onOpenIngestModal={() => setIsIngestModalOpen(true)}
          quarantinedCount={quarantinedCount}
        />

        {/* Clean, Focused Pipeline Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          {currentRoute === 'dashboard' && (
            <DashboardPage
              onNavigate={setCurrentRoute}
              onInjectSample={handleInjectSample}
              onOpenVerification={() => setIsVerificationOpen(true)}
              totalEvents={events.length}
              avgLatencyMs={avgLatencyMs}
              losslessRatePct={100}
            />
          )}

          {currentRoute === 'ingest' && (
            <DirectIngestPage
              onEventsIngested={(newEvents) => {
                setEvents((prev) => {
                  const existingIds = new Set(prev.map((e) => e.id));
                  const uniqueNew: ProcessedStreamEvent[] = [];
                  for (const ev of newEvents) {
                    if (!existingIds.has(ev.id)) {
                      existingIds.add(ev.id);
                      uniqueNew.push(ev);
                    }
                  }
                  return [...uniqueNew, ...prev].slice(0, 299);
                });
              }}
              isStreamRunning={isStreamRunning}
              onToggleStream={handleToggleStream}
              onNavigate={setCurrentRoute}
            />
          )}

          {(currentRoute === 'sources' || currentRoute === 'workbench') && (
            <SourcesPage
              initialWorkbenchPayload={workbenchPayload}
              onOpenVerification={() => setIsVerificationOpen(true)}
            />
          )}

          {currentRoute === 'events' && (
            <EventsPage
              events={events}
              isStreamRunning={isStreamRunning}
              onToggleStream={handleToggleStream}
              onInjectSingleEvent={handleInjectPulse}
              onEventsIngested={(newEvents) => {
                setEvents((prev) => {
                  const existingIds = new Set(prev.map((e) => e.id));
                  const uniqueNew: ProcessedStreamEvent[] = [];
                  for (const ev of newEvents) {
                    if (!existingIds.has(ev.id)) {
                      existingIds.add(ev.id);
                      uniqueNew.push(ev);
                    }
                  }
                  return [...uniqueNew, ...prev].slice(0, 299);
                });
              }}
            />
          )}

          {currentRoute === 'drift' && (
            <DriftPage
              onNavigateToWorkbench={(sample) => {
                setWorkbenchPayload(sample);
                setCurrentRoute('sources');
              }}
            />
          )}

          {(currentRoute === 'outputs' || currentRoute === 'mappings') && (
            <OutputProfilesPage />
          )}

          {currentRoute === 'settings' && <SettingsPage />}
        </main>
      </div>

      {/* Global Modals */}
      <QuickActionPalette
        isOpen={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
        onNavigate={setCurrentRoute}
        onSelectSample={handleInjectSample}
      />

      <KeyboardShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      <IngestLogsModal
        isOpen={isIngestModalOpen}
        onClose={() => setIsIngestModalOpen(false)}
        onEventsIngested={(newEvents: ProcessedStreamEvent[]) => {
          setEvents((prev) => {
            const existingIds = new Set(prev.map((e) => e.id));
            const uniqueNew: ProcessedStreamEvent[] = [];
            for (const ev of newEvents) {
              if (!existingIds.has(ev.id)) {
                existingIds.add(ev.id);
                uniqueNew.push(ev);
              }
            }
            return [...uniqueNew, ...prev].slice(0, 299);
          });
        }}
      />

      <VerificationModal
        isOpen={isVerificationOpen}
        onClose={() => setIsVerificationOpen(false)}
      />
    </div>
  );
}
