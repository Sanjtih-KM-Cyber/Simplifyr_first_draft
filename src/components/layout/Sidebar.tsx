/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  LayoutDashboard,
  Server,
  Database,
  GitBranch,
  AlertTriangle,
  Settings,
  Terminal,
  ShieldCheck,
  Zap,
  Activity,
} from 'lucide-react';
import { Badge } from '../ui/badge.tsx';

export interface SidebarProps {
  currentRoute: string;
  onNavigate: (route: string) => void;
  quarantinedCount?: number;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

const navigation = [
  { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard, shortcut: '1' },
  { id: 'sources', name: 'Sources', icon: Server, shortcut: '2' },
  { id: 'events', name: 'Events', icon: Database, shortcut: '3' },
  { id: 'drift', name: 'Drift & Quarantine', icon: AlertTriangle, shortcut: '4', hasBadge: true },
  { id: 'mappings', name: 'Field Mappings', icon: GitBranch, shortcut: '5' },
  { id: 'workbench', name: 'Normalizer Workbench', icon: Terminal, shortcut: '6' },
  { id: 'verification', name: 'Golden Verification', icon: ShieldCheck, shortcut: '7' },
  { id: 'settings', name: 'Settings', icon: Settings, shortcut: '8' },
];

export const Sidebar: React.FC<SidebarProps> = ({
  currentRoute,
  onNavigate,
  quarantinedCount = 0,
  isOpenMobile = false,
  onCloseMobile,
}) => {
  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-xs lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed left-0 top-0 z-50 h-screen w-64 border-r border-zinc-800/80 bg-zinc-950 flex flex-col transition-transform duration-200 lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between px-5 border-b border-zinc-800/80 bg-zinc-950">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono font-bold shadow-xs">
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <span className="text-sm font-bold tracking-tight text-zinc-100 font-sans">Simplifyr</span>
              <span className="text-[10px] font-mono font-medium text-emerald-400 block -mt-0.5">ULPF CORE</span>
            </div>
          </div>
          <Badge variant="outline" className="text-[10px] text-zinc-400 border-zinc-700 font-mono px-1.5 py-0.5">
            v0.1.0
          </Badge>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <div className="px-2 py-1 text-[10px] font-mono font-semibold uppercase text-zinc-500 tracking-wider">
            Pipeline Operations
          </div>
          {navigation.map((item) => {
            const isActive = currentRoute === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id);
                  if (onCloseMobile) onCloseMobile();
                }}
                className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-colors cursor-pointer select-none ${
                  isActive
                    ? 'bg-zinc-800/90 text-zinc-100 font-semibold shadow-xs border border-zinc-700/60'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <item.icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-emerald-400' : 'text-zinc-400'}`} />
                  <span>{item.name}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  {item.hasBadge && quarantinedCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      {quarantinedCount}
                    </span>
                  )}
                  <kbd className="hidden lg:inline-block font-mono text-[10px] text-zinc-500 bg-zinc-900 border border-zinc-800 rounded px-1.5">
                    {item.shortcut}
                  </kbd>
                </div>
              </button>
            );
          })}
        </nav>

        {/* Footer Status Bar */}
        <div className="p-3 border-t border-zinc-800/80 bg-zinc-950 text-xs">
          <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/60 border border-zinc-800 text-[11px] font-mono">
            <div className="flex items-center gap-1.5 text-zinc-300">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span>Sub-2ms SLA</span>
            </div>
            <span className="text-emerald-400 font-semibold">100% Lossless</span>
          </div>
        </div>
      </aside>
    </>
  );
};
