/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Menu,
  Bell,
  Sparkles,
  Command,
  HelpCircle,
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  PanelRight,
} from 'lucide-react';
import { Button } from '../ui/button.tsx';
import { Badge } from '../ui/badge.tsx';

export interface HeaderProps {
  currentRoute: string;
  onOpenMobileMenu: () => void;
  onOpenShortcuts: () => void;
  onOpenCommandPalette?: () => void;
  onInjectPulse: () => void;
  isStreamRunning: boolean;
  onToggleStream: () => void;
  quarantinedCount: number;
  isDockOpen?: boolean;
  onToggleDock?: () => void;
  hasSelectedEvent?: boolean;
}

const ROUTE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  sources: 'Perimeter Sources',
  events: 'Event Explorer',
  drift: 'Drift & Quarantine',
  mappings: 'Field Mappings & Knowledge',
  workbench: 'Normalizer Workbench',
  verification: 'Golden Verification',
  settings: 'System Settings',
};

export const Header: React.FC<HeaderProps> = ({
  currentRoute,
  onOpenMobileMenu,
  onOpenShortcuts,
  onOpenCommandPalette,
  onInjectPulse,
  isStreamRunning,
  onToggleStream,
  quarantinedCount,
  isDockOpen = false,
  onToggleDock,
  hasSelectedEvent = false,
}) => {
  const [showNotifications, setShowNotifications] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md px-4 lg:px-6">
      {/* Left: Mobile Toggle & Breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          className="lg:hidden p-1.5 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
          onClick={onOpenMobileMenu}
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2 text-xs">
          <span className="font-mono text-zinc-500 hidden sm:inline">Simplifyr</span>
          <span className="text-zinc-600 hidden sm:inline">/</span>
          <span className="font-semibold text-zinc-100 font-sans text-sm">
            {ROUTE_LABELS[currentRoute] || 'Overview'}
          </span>
        </div>
      </div>

      {/* Right: Quick Pulse, Status Badge, Notifications, Shortcuts */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Quick Pulse Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={onInjectPulse}
          className="h-8 text-[11px] font-mono border-zinc-800 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-200"
          title="Inject 1 simulated perimeter telemetry event"
        >
          <Sparkles className="h-3 w-3 text-emerald-400 mr-1.5" />
          <span className="hidden sm:inline">Inject Pulse</span>
        </Button>

        {/* Command Palette trigger */}
        {onOpenCommandPalette && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenCommandPalette}
            className="h-8 px-2 text-zinc-400 hover:text-zinc-200"
            title="Open Command Palette (⌘K)"
          >
            <Command className="h-3.5 w-3.5 mr-1" />
            <span className="font-mono text-[10px] hidden md:inline">⌘K</span>
          </Button>
        )}

        {/* Shortcuts button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenShortcuts}
          className="h-8 w-8 text-zinc-400 hover:text-zinc-200"
          title="Keyboard Shortcuts (?)"
        >
          <HelpCircle className="h-4 w-4" />
        </Button>

        {/* Concept A: Collapsible Inspector Dock Toggle */}
        {onToggleDock && (
          <Button
            variant={isDockOpen ? 'secondary' : 'ghost'}
            size="sm"
            onClick={onToggleDock}
            className={`h-8 px-2.5 text-xs font-mono border transition-all ${
              isDockOpen
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/25'
                : 'text-zinc-400 border-transparent hover:text-zinc-200 hover:bg-zinc-800'
            }`}
            title="Toggle Live Inspector Side-Dock"
          >
            <PanelRight className="h-3.5 w-3.5 mr-1.5" />
            <span className="hidden md:inline">Inspector</span>
            {hasSelectedEvent && !isDockOpen && (
              <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </Button>
        )}

        {/* Notifications Popover */}
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative h-8 w-8 text-zinc-400 hover:text-zinc-200"
            aria-label="View notifications"
          >
            <Bell className="h-4 w-4" />
            {quarantinedCount > 0 && (
              <span className="absolute 0 top-0.5 right-0.5 flex h-2 w-2 rounded-full bg-amber-500" />
            )}
          </Button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 rounded-xl border border-zinc-800 bg-zinc-950 p-3 shadow-2xl z-50 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                <span className="font-semibold text-zinc-200">System Notifications</span>
                <Badge variant="outline" className="text-[10px] font-mono">
                  {quarantinedCount} drift alerts
                </Badge>
              </div>

              <div className="py-2 space-y-2 max-h-60 overflow-y-auto">
                {quarantinedCount > 0 ? (
                  <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20 text-zinc-300">
                    <div className="flex items-center gap-1.5 text-amber-400 font-semibold text-[11px]">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Schema Drift Quarantined
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-1">
                      {quarantinedCount} perimeter event{quarantinedCount > 1 ? 's' : ''} isolated pending schema patch approval.
                    </p>
                  </div>
                ) : (
                  <div className="p-2 text-center text-zinc-500 text-xs">
                    No active drift alerts. All perimeter schemas aligned.
                  </div>
                )}

                <div className="p-2 rounded bg-zinc-900 border border-zinc-800 text-zinc-300">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-[11px]">
                    <CheckCircle className="h-3.5 w-3.5" />
                    SLA Verification
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Pipeline latency benchmark stable at sub-2ms per event.
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-zinc-800 text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px] text-zinc-400"
                  onClick={() => setShowNotifications(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
