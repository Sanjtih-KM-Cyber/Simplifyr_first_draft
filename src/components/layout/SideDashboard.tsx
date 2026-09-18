/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import {
  Shield,
  Zap,
  Flame,
  ShieldCheck,
  Terminal,
  Layers,
  Cpu,
  Lock,
  Clock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Command,
  Keyboard,
  Play,
  Download,
} from 'lucide-react';
import { GOLDEN_CORPUS } from '../../data/goldenCorpus.ts';

export type AppWorkspaceTab =
  | 'workbench'
  | 'stream'
  | 'drift'
  | 'verification'
  | 'phase1'
  | 'phase2'
  | 'phase3'
  | 'phase4'
  | 'phase5';

interface SideDashboardProps {
  activeTab: AppWorkspaceTab;
  onSelectTab: (tab: AppWorkspaceTab) => void;
  onOpenRegistry?: () => void;
  onOpenShortcuts?: () => void;
  onOpenCommandPalette?: () => void;
  onSelectSample?: (raw: string) => void;
  onExportForensicBundle?: () => void;
  totalParsedCount: number;
  avgLatencyMs: number;
  losslessPct: number;
  latencies?: number[];
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const SideDashboard: React.FC<SideDashboardProps> = ({
  activeTab,
  onSelectTab,
  onOpenRegistry,
  onOpenShortcuts,
  onOpenCommandPalette,
  onSelectSample,
  onExportForensicBundle,
  totalParsedCount,
  avgLatencyMs,
  losslessPct,
  latencies = [0.18, 0.22, 0.15, 0.19, 0.25, 0.21, 0.16, 0.14, 0.17, 0.2, 0.15],
  isCollapsed = false,
  onToggleCollapse,
}) => {
  // Normalize active tab for clean 4-tab model
  const normalizedTab: 'workbench' | 'stream' | 'drift' | 'verification' = useMemo(() => {
    if (activeTab === 'phase4' || activeTab === 'stream') return 'stream';
    if (activeTab === 'phase5' || activeTab === 'drift') return 'drift';
    if (activeTab === 'verification') return 'verification';
    return 'workbench';
  }, [activeTab]);

  // Compute SVG Sparkline path for Latency HUD
  const sparklineData = useMemo(() => {
    if (latencies.length < 2) return '';
    const min = Math.min(...latencies);
    const max = Math.max(...latencies) || 1;
    const range = max - min || 0.1;
    const width = 190;
    const height = 24;

    const points = latencies.map((val, idx) => {
      const x = (idx / (latencies.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 6) - 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    return `M ${points.join(' L ')}`;
  }, [latencies]);

  const minLatency = latencies.length ? Math.min(...latencies).toFixed(2) : '0.12';
  const maxLatency = latencies.length ? Math.max(...latencies).toFixed(2) : '0.28';

  const workspaces = [
    {
      id: 'workbench' as const,
      name: 'Workbench',
      description: 'Plug & Play Normalizer',
      icon: Terminal,
      shortcut: '1',
      activeGradient: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/40',
      iconColor: 'text-emerald-400',
    },
    {
      id: 'stream' as const,
      name: 'Live Stream',
      description: 'Multi-Vendor Ingestion',
      icon: Zap,
      shortcut: '2',
      activeGradient: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/40',
      iconColor: 'text-emerald-400',
    },
    {
      id: 'drift' as const,
      name: 'Drift Chamber',
      description: 'Quarantine & AI Diffing',
      icon: Flame,
      shortcut: '3',
      activeGradient: 'bg-amber-500/10 text-amber-300 border-amber-500/40',
      iconColor: 'text-amber-400',
    },
    {
      id: 'verification' as const,
      name: 'Verification',
      description: 'Phase 6 Golden Tests',
      icon: ShieldCheck,
      shortcut: '4',
      activeGradient: 'bg-purple-500/10 text-purple-300 border-purple-500/40',
      iconColor: 'text-purple-400',
    },
  ];

  return (
    <aside
      id="side-dashboard"
      className={`${
        isCollapsed ? 'w-16' : 'w-72'
      } bg-zinc-950 border-r border-zinc-800 text-zinc-300 flex flex-col justify-between shrink-0 h-screen select-none font-sans transition-all duration-200 z-20`}
    >
      {/* Top Header & Brand */}
      <div className="flex flex-col min-h-0">
        {/* Brand Banner */}
        <div className="p-3 border-b border-zinc-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Shield className="w-4 h-4" />
            </div>
            {!isCollapsed && (
              <div className="truncate">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold tracking-wider text-zinc-100 font-mono">
                    SIMPLIFYR
                  </span>
                  <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                    ULPF
                  </span>
                </div>
                <div className="text-[10px] text-zinc-500 font-mono truncate">
                  Zero-Loss • Sub-2ms
                </div>
              </div>
            )}
          </div>

          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors cursor-pointer shrink-0"
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>

        {/* Workspace Nav Items */}
        <div className="p-2 space-y-1 overflow-y-auto min-h-0 scrollbar-none">
          {!isCollapsed && (
            <div className="px-2 pt-1 pb-1 text-[10px] uppercase tracking-wider font-semibold text-zinc-500 flex items-center justify-between font-mono">
              <span>Workspaces</span>
              <span>[1-4]</span>
            </div>
          )}

          {workspaces.map((ws) => {
            const Icon = ws.icon;
            const isActive = normalizedTab === ws.id;

            return (
              <button
                key={ws.id}
                id={`tab-${ws.id}-btn`}
                onClick={() => onSelectTab(ws.id)}
                title={isCollapsed ? `${ws.name} [${ws.shortcut}]` : undefined}
                className={`w-full flex items-center gap-2.5 p-2 rounded-lg text-xs font-medium cursor-pointer transition-all border ${
                  isActive
                    ? `${ws.activeGradient} shadow-xs font-semibold`
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border-transparent'
                } ${isCollapsed ? 'justify-center px-0' : ''}`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? ws.iconColor : 'text-zinc-500'}`} />

                {!isCollapsed && (
                  <>
                    <div className="flex flex-col text-left truncate flex-1">
                      <span className="text-zinc-100">{ws.name}</span>
                      <span className="text-[10px] text-zinc-500 font-normal truncate">
                        {ws.description}
                      </span>
                    </div>
                    <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800 shrink-0">
                      {ws.shortcut}
                    </kbd>
                  </>
                )}
              </button>
            );
          })}

          {/* Versioned Knowledge Registry */}
          {onOpenRegistry && (
            <button
              id="btn-knowledge-registry"
              onClick={onOpenRegistry}
              title={isCollapsed ? 'Knowledge Registry [R]' : undefined}
              className={`w-full flex items-center gap-2.5 p-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 text-xs font-medium cursor-pointer border border-zinc-800/80 hover:border-purple-500/40 transition-all group ${
                isCollapsed ? 'justify-center px-0' : ''
              }`}
            >
              <Layers className="w-4 h-4 text-purple-400 shrink-0 group-hover:rotate-12 transition-transform" />
              {!isCollapsed && (
                <>
                  <div className="flex flex-col text-left truncate flex-1">
                    <span className="text-zinc-200">Knowledge Registry</span>
                    <span className="text-[10px] text-zinc-500 font-normal">Schemas & Mappings</span>
                  </div>
                  <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-900 text-purple-400 border border-zinc-800 shrink-0">
                    R
                  </kbd>
                </>
              )}
            </button>
          )}

          {/* Plug & Play Presets List (when expanded) */}
          {!isCollapsed && (
            <div className="pt-2">
              <div className="px-2 py-1 text-[10px] uppercase tracking-wider font-semibold text-zinc-500 flex items-center justify-between font-mono">
                <span>Plug & Play Presets</span>
                <span className="text-emerald-400">1-CLICK</span>
              </div>

              <div className="space-y-0.5 mt-1">
                {GOLDEN_CORPUS.slice(0, 6).map((sample) => (
                  <button
                    key={sample.id}
                    onClick={() => {
                      onSelectTab('workbench');
                      if (onSelectSample) onSelectSample(sample.raw);
                    }}
                    className="w-full flex items-center justify-between px-2 py-1.5 rounded text-[11px] font-mono text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors cursor-pointer text-left"
                    title={`Load ${sample.name}`}
                  >
                    <span className="truncate flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/70" />
                      {sample.name}
                    </span>
                    <span className="text-[9px] text-zinc-500 uppercase shrink-0 pl-1">
                      {sample.format}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Telemetry HUD & Footer */}
      <div className="border-t border-zinc-800 bg-zinc-950 shrink-0">
        {!isCollapsed && (
          <div className="p-3 space-y-2">
            {/* Live Throughput HUD */}
            <div className="p-2 rounded-lg bg-zinc-900/80 border border-zinc-800 text-xs space-y-2">
              <div className="flex items-center justify-between text-[10px] font-mono font-semibold text-zinc-400">
                <span className="flex items-center gap-1 text-emerald-400">
                  <Cpu className="w-3 h-3" />
                  PIPELINE TELEMETRY
                </span>
                <span className="text-emerald-400 font-bold">ACTIVE</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                <div>
                  <div className="text-[9px] text-zinc-500">INGESTED</div>
                  <div className="text-zinc-200 font-bold">{totalParsedCount} events</div>
                </div>
                <div>
                  <div className="text-[9px] text-zinc-500">AVG LATENCY</div>
                  <div className="text-emerald-400 font-bold">{avgLatencyMs.toFixed(2)} ms</div>
                </div>
              </div>

              {/* Sparkline */}
              {sparklineData && (
                <div className="h-6 w-full pt-1">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 190 24">
                    <path
                      d={sparklineData}
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              )}

              <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 pt-1 border-t border-zinc-800/80">
                <span className="flex items-center gap-1 text-emerald-400">
                  <Lock className="w-3 h-3" />
                  Zero-Loss: {losslessPct}%
                </span>
                <span className="text-zinc-500 font-mono">SHA-256</span>
              </div>
            </div>
          </div>
        )}

        {/* Quick Toolbar */}
        <div className={`p-2 flex items-center ${isCollapsed ? 'flex-col gap-2' : 'justify-between'} border-t border-zinc-800/80 text-xs`}>
          {onOpenCommandPalette && (
            <button
              onClick={onOpenCommandPalette}
              className="px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 text-[11px] font-mono flex items-center gap-1 border border-zinc-800 transition-colors cursor-pointer"
              title="Open Command Palette (⌘K)"
            >
              <Command className="w-3 h-3 text-zinc-400" />
              {!isCollapsed && <span>Palette [⌘K]</span>}
            </button>
          )}

          {onOpenShortcuts && (
            <button
              onClick={onOpenShortcuts}
              className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors cursor-pointer"
              title="Keyboard Shortcuts (?)"
              aria-label="Keyboard Shortcuts"
            >
              <Keyboard className="w-4 h-4" />
            </button>
          )}

          {onExportForensicBundle && !isCollapsed && (
            <button
              onClick={onExportForensicBundle}
              className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors cursor-pointer"
              title="Export Forensic Audit Bundle"
              aria-label="Export Forensic Audit"
            >
              <Download className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};
