/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Layers,
  CheckCircle2,
  GitBranch,
  Shield,
  FileCode,
  Search,
  Filter,
  ArrowRight,
  Plus,
  Info,
  X,
} from 'lucide-react';
import { knowledgeRegistry } from '../../services/knowledgeRegistry.ts';
import { PerimeterVendor, VersionedMapping } from '../../types.ts';

interface KnowledgeRegistryExplorerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMapping?: (mapping: VersionedMapping) => void;
}

export const KnowledgeRegistryExplorer: React.FC<KnowledgeRegistryExplorerProps> = ({
  isOpen,
  onClose,
  onSelectMapping,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [vendorFilter, setVendorFilter] = useState<string>('all');
  const [selectedMapping, setSelectedMapping] = useState<VersionedMapping | null>(
    knowledgeRegistry.getAllMappings()[0] || null
  );
  const [showAddVersionModal, setShowAddVersionModal] = useState(false);
  const [newVersionInput, setNewVersionInput] = useState('');
  const [newNotesInput, setNewNotesInput] = useState('');

  if (!isOpen) return null;

  const allMappings = knowledgeRegistry.getAllMappings();

  const filteredMappings = allMappings.filter((m) => {
    const matchesVendor = vendorFilter === 'all' || m.vendor === vendorFilter;
    const matchesSearch =
      m.product.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.mapping_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.software_version.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.event_family.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesVendor && matchesSearch;
  });

  const handleCreateNewVersion = () => {
    if (!selectedMapping || !newVersionInput.trim()) return;
    try {
      const created = knowledgeRegistry.registerNewVersion(
        selectedMapping.mapping_id,
        newVersionInput.trim(),
        [...selectedMapping.rules],
        'SecOps Admin (Interactive)',
        newNotesInput.trim() || 'New version created in Knowledge Registry'
      );
      setSelectedMapping(created);
      setShowAddVersionModal(false);
      setNewVersionInput('');
      setNewNotesInput('');
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6 animate-in fade-in duration-150">
      <div className="bg-zinc-900 border border-zinc-700/80 rounded-xl w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl overflow-hidden font-sans">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/60">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-zinc-100">
                  Versioned Knowledge Registry
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-medium">
                  {allMappings.length} Active Profiles
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Vendor knowledge stored strictly as data, decoupling parser logic from schema evolution.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub-header Toolbar */}
        <div className="px-6 py-3 border-b border-zinc-800/80 bg-zinc-900/50 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                placeholder="Search by vendor, product, software version..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-md bg-zinc-950 border border-zinc-800 text-zinc-200 placeholder-zinc-500 text-xs focus:outline-hidden focus:border-emerald-500/60"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-zinc-500" />
            <select
              value={vendorFilter}
              onChange={(e) => setVendorFilter(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs rounded-md px-2.5 py-1.5 focus:outline-hidden focus:border-emerald-500/60"
            >
              <option value="all">All Vendors</option>
              <option value="cisco_asa">Cisco ASA</option>
              <option value="palo_alto">Palo Alto PAN-OS</option>
              <option value="fortinet_fortigate">Fortinet FortiGate</option>
              <option value="checkpoint_quantum">Check Point Quantum</option>
              <option value="snort_ids">Snort IDS</option>
              <option value="generic_firewall">Generic Cloud Gateway</option>
            </select>
          </div>
        </div>

        {/* Modal Main Body (2 columns) */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column: List of Mappings */}
          <div className="w-80 border-r border-zinc-800 overflow-y-auto bg-zinc-950/40 p-3 space-y-2">
            {filteredMappings.map((m) => {
              const isSelected = selectedMapping?.mapping_id === m.mapping_id;
              return (
                <div
                  key={m.mapping_id}
                  onClick={() => setSelectedMapping(m)}
                  className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-zinc-900 border-emerald-500/50 shadow-xs'
                      : 'bg-zinc-900/40 border-zinc-800/80 hover:bg-zinc-900 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-zinc-200 truncate">{m.product}</span>
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                      {m.software_version}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                    <span className="truncate">{m.event_family}</span>
                    <span>•</span>
                    <span className="font-mono text-emerald-400 text-[10px]">
                      {m.rules.length} rules
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[10px] text-zinc-500">
                    <span className="uppercase font-mono text-zinc-500">{m.format}</span>
                    <span className="inline-flex items-center gap-1 text-emerald-400">
                      <CheckCircle2 className="w-2.5 h-2.5" />
                      {m.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Detailed Rules Inspector & Versioning */}
          <div className="flex-1 overflow-y-auto p-6 bg-zinc-900/60">
            {selectedMapping ? (
              <div className="space-y-6">
                {/* Profile Overview Card */}
                <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800/90 flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2.5 mb-1">
                      <h3 className="text-base font-semibold text-zinc-100">
                        {selectedMapping.product}
                      </h3>
                      <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Version {selectedMapping.software_version}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 mb-2">
                      Event Family: <span className="text-zinc-200">{selectedMapping.event_family}</span> | Format: <span className="font-mono text-zinc-300">{selectedMapping.format}</span>
                    </p>
                    <div className="flex items-center gap-4 text-[11px] text-zinc-500">
                      <span>Approved by: <span className="text-zinc-300">{selectedMapping.approved_by}</span></span>
                      <span>Created: <span className="text-zinc-300">{new Date(selectedMapping.created_at).toLocaleDateString()}</span></span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => setShowAddVersionModal(true)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-medium text-xs flex items-center gap-1.5 transition-colors shadow-xs"
                    >
                      <GitBranch className="w-3.5 h-3.5" />
                      Branch New Version
                    </button>
                    {onSelectMapping && (
                      <button
                        onClick={() => {
                          onSelectMapping(selectedMapping);
                          onClose();
                        }}
                        className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors"
                      >
                        Apply to Workbench
                      </button>
                    )}
                  </div>
                </div>

                {/* Change notes if any */}
                {selectedMapping.change_notes && (
                  <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 flex items-start gap-2.5 text-xs text-zinc-300">
                    <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-zinc-200">Version Changelog: </span>
                      <span className="text-zinc-400">{selectedMapping.change_notes}</span>
                    </div>
                  </div>
                )}

                {/* Mapping Rules Table */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      Deterministic Field Mapping Rules ({selectedMapping.rules.length})
                    </h4>
                    <span className="text-[11px] text-zinc-500">
                      Decoupled Canonical Abstraction
                    </span>
                  </div>

                  <div className="rounded-lg border border-zinc-800 overflow-hidden bg-zinc-950">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-zinc-800 bg-zinc-900/60 text-zinc-400 text-[11px]">
                          <th className="py-2.5 px-3 font-medium">Input Source Field</th>
                          <th className="py-2.5 px-3 font-medium">Transformation</th>
                          <th className="py-2.5 px-3 font-medium">Canonical Semantic Field</th>
                          <th className="py-2.5 px-3 font-medium text-right">Confidence</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/60 font-mono">
                        {selectedMapping.rules.map((rule, idx) => (
                          <tr key={idx} className="hover:bg-zinc-900/40">
                            <td className="py-2 px-3 text-zinc-300">
                              {rule.input_field}
                            </td>
                            <td className="py-2 px-3">
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-sans font-medium ${
                                  rule.transformation_type === 'identity'
                                    ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                    : rule.transformation_type === 'enum'
                                    ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                }`}
                              >
                                {rule.transformation_type}
                              </span>
                              {rule.enum_map && (
                                <span className="ml-2 text-[10px] text-zinc-500 font-sans">
                                  ({Object.keys(rule.enum_map).length} enums)
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-emerald-400 font-semibold">
                              {rule.semantic_field}
                            </td>
                            <td className="py-2 px-3 text-right">
                              <span className="text-[11px] text-zinc-400">
                                {Math.round(rule.confidence * 100)}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-zinc-500 text-xs">
                Select a vendor mapping profile from the left column
              </div>
            )}
          </div>
        </div>

        {/* Branch New Version Modal */}
        {showAddVersionModal && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-5 w-full max-w-md shadow-xl text-xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                <h3 className="font-semibold text-sm text-zinc-100 flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-emerald-400" />
                  Branch Version for {selectedMapping?.product}
                </h3>
                <button
                  onClick={() => setShowAddVersionModal(false)}
                  className="text-zinc-400 hover:text-zinc-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">New Software Version String</label>
                <input
                  type="text"
                  placeholder="e.g. v10.3 or v9.19"
                  value={newVersionInput}
                  onChange={(e) => setNewVersionInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">Change Notes / Reason</label>
                <textarea
                  rows={3}
                  placeholder="e.g. Updated connection teardown syntax and NAT port fields"
                  value={newNotesInput}
                  onChange={(e) => setNewNotesInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowAddVersionModal(false)}
                  className="px-3 py-1.5 rounded-md bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateNewVersion}
                  disabled={!newVersionInput.trim()}
                  className="px-4 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-medium disabled:opacity-50"
                >
                  Confirm Version Branch
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
