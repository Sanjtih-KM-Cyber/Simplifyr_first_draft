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
import { MappingsPage } from './components/pages/MappingsPage.tsx';
import { WorkbenchPage } from './components/pages/WorkbenchPage.tsx';
import { VerificationPage } from './components/pages/VerificationPage.tsx';
import { SettingsPage } from './components/pages/SettingsPage.tsx';
import { QuickActionPalette } from './components/common/QuickActionPalette.tsx';
import { KeyboardShortcutsModal } from './components/common/KeyboardShortcutsModal.tsx';
import { InspectorDock } from './components/layout/InspectorDock.tsx';
import { ProcessedStreamEvent, QuarantinedEvent } from './types.ts';
import { streamSimulator } from './services/streamSimulator.ts';
import { quarantineManager } from './services/quarantineManager.ts';

export default function App() {
  const [currentRoute, setCurrentRoute] = useState<string>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState<boolean>(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState<boolean>(false);
  const [workbenchPayload, setWorkbenchPayload] = useState<string | undefined>(undefined);
  const [quarantinedCount, setQuarantinedCount] = useState<number>(0);

  // Concept A: Collapsible Inspector Dock State
  const [isDockOpen, setIsDockOpen] = useState<boolean>(false);
  const [selectedEvent, setSelectedEvent] = useState<ProcessedStreamEvent | null>(null);
  const [selectedQuarantineItem, setSelectedQuarantineItem] = useState<QuarantinedEvent | null>(null);

  // Live Stream & Events State (Clean unmocked state, populated via live stream or real ingestion)
  const [events, setEvents] = useState<ProcessedStreamEvent[]>([]);
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
      setEvents((prev) => {
        if (prev.some((e) => e.id === newEvent.id)) return prev;
        return [newEvent, ...prev.slice(0, 199)];
      });
      setLatencies((prev) => [...prev.slice(-19), newEvent.latencyMs]);
    });

    return () => {
      streamSimulator.stop();
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
    // streamSimulator.pulse() automatically invokes onEventCallback
    streamSimulator.pulse();
  };

  const handleInjectSample = (sampleRaw: string) => {
    setWorkbenchPayload(sampleRaw);
    setCurrentRoute('workbench');
  };

  const handleSelectEvent = (ev: ProcessedStreamEvent) => {
    setSelectedEvent(ev);
    const qItem = quarantineManager.get(ev.id);
    setSelectedQuarantineItem(qItem || null);
    setIsDockOpen(true);
  };

  const handleEventUpdated = (updatedEv: ProcessedStreamEvent) => {
    setEvents((prev) =>
      prev.map((e) => (e.id === updatedEv.id ? updatedEv : e))
    );
    setSelectedEvent(updatedEv);
    const qItem = quarantineManager.get(updatedEv.id);
    setSelectedQuarantineItem(qItem || null);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          (activeEl as HTMLElement).isContentEditable);

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
        if (isDockOpen) {
          setIsDockOpen(false);
          return;
        }
      }

      if (isInput) return;

      const keyRouteMap: Record<string, string> = {
        '1': 'dashboard',
        '2': 'sources',
        '3': 'events',
        '4': 'drift',
        '5': 'mappings',
        '6': 'workbench',
        '7': 'verification',
        '8': 'settings',
      };

      if (keyRouteMap[e.key]) {
        e.preventDefault();
        setCurrentRoute(keyRouteMap[e.key]);
      } else if (e.key.toLowerCase() === 'i') {
        e.preventDefault();
        if (!isDockOpen && !selectedEvent && events.length > 0) {
          handleSelectEvent(events[0]);
        } else {
          setIsDockOpen((prev) => !prev);
        }
      } else if (e.key === '?') {
        e.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPaletteOpen, isShortcutsOpen]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans antialiased flex">
      {/* Fixed Left Sidebar */}
      <Sidebar
        currentRoute={currentRoute}
        onNavigate={setCurrentRoute}
        quarantinedCount={quarantinedCount}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main App Canvas */}
      <div className="lg:pl-64 flex flex-col flex-1 min-h-screen w-full bg-zinc-950">
        {/* Top Sticky Header */}
        <Header
          currentRoute={currentRoute}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          onOpenShortcuts={() => setIsShortcutsOpen(true)}
          onOpenCommandPalette={() => setIsPaletteOpen(true)}
          onInjectPulse={handleInjectPulse}
          isStreamRunning={isStreamRunning}
          onToggleStream={handleToggleStream}
          quarantinedCount={quarantinedCount}
          isDockOpen={isDockOpen}
          onToggleDock={() => {
            if (!isDockOpen && !selectedEvent && events.length > 0) {
              handleSelectEvent(events[0]);
            } else {
              setIsDockOpen((prev) => !prev);
            }
          }}
          hasSelectedEvent={!!selectedEvent}
        />

        {/* Uncluttered Page Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          {currentRoute === 'dashboard' && (
            <DashboardPage
              onNavigate={setCurrentRoute}
              onInjectSample={handleInjectSample}
              totalEvents={events.length + 84210}
              avgLatencyMs={avgLatencyMs}
              losslessRatePct={100}
            />
          )}

          {currentRoute === 'sources' && (
            <SourcesPage onTestSampleInWorkbench={handleInjectSample} />
          )}

          {currentRoute === 'events' && (
            <EventsPage
              events={events}
              onSelectEvent={handleSelectEvent}
              selectedEventId={selectedEvent?.id}
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
                if (newEvents.length > 0 && !selectedEvent) {
                  handleSelectEvent(newEvents[0]);
                }
              }}
            />
          )}

          {currentRoute === 'drift' && (
            <DriftPage
              onInspectInDock={(item) => {
                setSelectedEvent(item.event);
                setSelectedQuarantineItem(item);
                setIsDockOpen(true);
              }}
            />
          )}

          {currentRoute === 'mappings' && <MappingsPage />}

          {currentRoute === 'workbench' && (
            <WorkbenchPage initialPayload={workbenchPayload} />
          )}

          {currentRoute === 'verification' && <VerificationPage />}

          {currentRoute === 'settings' && <SettingsPage />}
        </main>
      </div>

      {/* Global Modals */}
      <QuickActionPalette
        isOpen={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
        onNavigate={setCurrentRoute}
        onSelectSample={handleInjectSample}
        onToggleDock={() => {
          if (!isDockOpen && !selectedEvent && events.length > 0) {
            handleSelectEvent(events[0]);
          } else {
            setIsDockOpen((prev) => !prev);
          }
        }}
      />

      <KeyboardShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      {/* Concept A: Collapsible Inspector Dock */}
      <InspectorDock
        isOpen={isDockOpen}
        onClose={() => setIsDockOpen(false)}
        selectedEvent={selectedEvent}
        quarantinedItem={selectedQuarantineItem}
        onNavigateToWorkbench={(raw) => {
          handleInjectSample(raw);
          setIsDockOpen(false);
        }}
        onEventUpdated={handleEventUpdated}
      />
    </div>
  );
}
