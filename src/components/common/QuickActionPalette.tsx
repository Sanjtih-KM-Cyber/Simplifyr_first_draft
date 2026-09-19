/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  LayoutDashboard,
  Server,
  Database,
  AlertTriangle,
  GitBranch,
  Terminal,
  ShieldCheck,
  Settings,
  Play,
  Radio,
  X,
} from 'lucide-react';
import { GOLDEN_CORPUS } from '../../data/goldenCorpus.ts';

interface QuickActionPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (route: string) => void;
  onSelectSample?: (sampleRaw: string) => void;
}

export const QuickActionPalette: React.FC<QuickActionPaletteProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onSelectSample,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const actions = [
    {
      id: 'nav-dashboard',
      title: 'Dashboard',
      category: 'Navigation',
      hint: 'Pipeline overview, metrics, and health status',
      icon: LayoutDashboard,
      shortcut: '1',
      run: () => onNavigate('dashboard'),
    },
    {
      id: 'nav-ingest',
      title: 'Connect & Ingest Logs',
      category: 'Navigation',
      hint: 'Connect live syslog streams, send batch logs via HTTP Webhook, or drop log files',
      icon: Radio,
      shortcut: '2',
      run: () => onNavigate('ingest'),
    },
    {
      id: 'nav-sources',
      title: 'Sources & Onboarding',
      category: 'Navigation',
      hint: 'Manage connected appliances and onboard new devices via log samples',
      icon: Server,
      shortcut: '3',
      run: () => onNavigate('sources'),
    },
    {
      id: 'nav-events',
      title: 'Event Explorer',
      category: 'Navigation',
      hint: 'Inspect live perimeter events across [Raw], [Parsed], [Normalized], and [Output]',
      icon: Database,
      shortcut: '3',
      run: () => onNavigate('events'),
    },
    {
      id: 'nav-drift',
      title: 'Schema Drift & AI',
      category: 'Navigation',
      hint: 'Zero-day drift isolation, AI explanations, and human approval',
      icon: AlertTriangle,
      shortcut: '4',
      run: () => onNavigate('drift'),
    },
    {
      id: 'nav-outputs',
      title: 'Custom Output Schema & Profiles',
      category: 'Navigation',
      hint: 'Build custom schemas, configure SOC presets (Triage, Incident, Intel, ML), and rename keys',
      icon: GitBranch,
      shortcut: '5',
      run: () => onNavigate('outputs'),
    },
    {
      id: 'nav-settings',
      title: 'System Settings',
      category: 'Navigation',
      hint: 'Configure AI engine reasoning, retention policies, and endpoints',
      icon: Settings,
      shortcut: 'S',
      run: () => onNavigate('settings'),
    },
    // Golden samples
    ...GOLDEN_CORPUS.map((s) => ({
      id: `sample-${s.id}`,
      title: `Load Sample: ${s.name}`,
      category: 'Plug & Play Fixtures',
      hint: `${s.vendor.toUpperCase()} • ${s.format} • ${s.device}`,
      icon: Play,
      shortcut: '',
      run: () => {
        onNavigate('workbench');
        if (onSelectSample) onSelectSample(s.raw);
      },
    })),
  ];

  const filtered = actions.filter(
    (a) =>
      a.title.toLowerCase().includes(query.toLowerCase()) ||
      a.hint.toLowerCase().includes(query.toLowerCase()) ||
      a.category.toLowerCase().includes(query.toLowerCase())
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (filtered.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % (filtered.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].run();
        onClose();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[75vh]">
        {/* Search Input */}
        <div className="p-3 border-b border-zinc-800 flex items-center gap-2.5 bg-zinc-900/60">
          <Search className="w-4 h-4 text-zinc-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command, page name, or fixture..."
            className="w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 outline-none font-sans"
          />
          <button
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="p-2 space-y-1 overflow-y-auto flex-1 text-xs">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-zinc-500">No matching commands found.</div>
          ) : (
            filtered.map((action, idx) => {
              const isSelected = idx === selectedIndex;
              const Icon = action.icon;
              return (
                <button
                  key={action.id}
                  onClick={() => {
                    action.run();
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full text-left p-2.5 rounded-lg flex items-center justify-between transition-colors cursor-pointer ${
                    isSelected ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-900'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-md ${isSelected ? 'bg-zinc-700 text-emerald-400' : 'bg-zinc-900 text-zinc-400'}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-medium text-zinc-200">{action.title}</div>
                      <div className="text-[11px] text-zinc-500 font-sans">{action.hint}</div>
                    </div>
                  </div>
                  {action.shortcut && (
                    <kbd className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700/80 font-mono text-[10px] text-zinc-400 font-semibold">
                      {action.shortcut}
                    </kbd>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
