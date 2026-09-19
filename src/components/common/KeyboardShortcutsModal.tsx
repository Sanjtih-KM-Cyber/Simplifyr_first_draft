/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X, Keyboard } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const shortcuts = [
    {
      category: 'Pipeline Navigation',
      items: [
        { key: '1', description: 'Dashboard' },
        { key: '2', description: 'Sources & Onboarding' },
        { key: '3', description: 'Event Explorer' },
        { key: '4', description: 'Schema Drift & AI' },
        { key: '5', description: 'Output Profiles & Mappings' },
        { key: 'S', description: 'System Settings' },
      ],
    },
    {
      category: 'Operational Controls',
      items: [
        { key: '⌘ + K / Ctrl + K', description: 'Open Quick Action Command Palette' },
        { key: 'Space', description: 'Pause / Resume Stream Ingestion' },
        { key: '?', description: 'Open this Keyboard Shortcuts Guide' },
        { key: 'Esc', description: 'Dismiss active modals or drawers' },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Keyboard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">Keyboard Navigation</h3>
              <p className="text-[11px] text-zinc-500">Power-user shortcuts for clutter-free operations</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1 text-xs">
          {shortcuts.map((group) => (
            <div key={group.category} className="space-y-2">
              <div className="font-mono text-[10px] font-semibold uppercase text-zinc-500 tracking-wider">
                {group.category}
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                {group.items.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/60 border border-zinc-800/80 hover:bg-zinc-900 transition-colors"
                  >
                    <span className="text-zinc-300 font-sans">{item.description}</span>
                    <kbd className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-200 font-mono text-[11px] font-semibold">
                      {item.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="p-3 border-t border-zinc-800 bg-zinc-900/40 text-right">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium cursor-pointer"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
