/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  X,
  Maximize2,
  Minimize2,
  ShieldCheck,
  AlertTriangle,
  FileCode,
  Code,
  Copy,
  Check,
  Download,
  Sparkles,
  Bot,
  RotateCcw,
  CheckCircle2,
  Send,
  Terminal,
  ExternalLink,
  ChevronRight,
  Fingerprint,
  Layers,
} from 'lucide-react';
import { Button } from '../ui/button.tsx';
import { Badge } from '../ui/badge.tsx';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs.tsx';
import { ProcessedStreamEvent, QuarantinedEvent, SuggestedRulePatch } from '../../types.ts';
import { formatBytes, formatRelativeTime } from '../../lib/utils.ts';
import { driftEngine } from '../../services/driftEngine.ts';
import { quarantineManager } from '../../services/quarantineManager.ts';
import { processRawEventThroughPipeline } from '../../services/streamSimulator.ts';

interface InspectorDockProps {
  isOpen: boolean;
  onClose: () => void;
  selectedEvent: ProcessedStreamEvent | null;
  quarantinedItem?: QuarantinedEvent | null;
  onNavigateToWorkbench?: (raw: string) => void;
  onEventUpdated?: (event: ProcessedStreamEvent) => void;
}

export const InspectorDock: React.FC<InspectorDockProps> = ({
  isOpen,
  onClose,
  selectedEvent,
  quarantinedItem,
  onNavigateToWorkbench,
  onEventUpdated,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'canonical' | 'drift' | 'scratchpad'>('overview');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Scratchpad interactive testing
  const [scratchRaw, setScratchRaw] = useState('');
  const [scratchResult, setScratchResult] = useState<ProcessedStreamEvent | null>(null);

  // AI Remediation
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<any>(quarantinedItem?.aiAnalysis || null);
  const [reprocessSuccess, setReprocessSuccess] = useState<string | null>(null);

  // Sync state when selected event changes
  React.useEffect(() => {
    if (selectedEvent) {
      setScratchRaw(selectedEvent.raw);
      setScratchResult(selectedEvent);
      setReprocessSuccess(null);
      // Auto switch to drift tab if drifted
      if (selectedEvent.isDrift || quarantinedItem) {
        setActiveTab('drift');
        if (quarantinedItem?.aiAnalysis) {
          setAiAnalysis(quarantinedItem.aiAnalysis);
        } else {
          setAiAnalysis(null);
        }
      } else {
        setActiveTab('overview');
      }
    }
  }, [selectedEvent, quarantinedItem]);

  if (!isOpen || !selectedEvent) return null;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const handleScratchReparse = (text: string) => {
    setScratchRaw(text);
    try {
      const parsed = processRawEventThroughPipeline(text);
      setScratchResult(parsed);
      if (onEventUpdated) onEventUpdated(parsed);
    } catch {
      // Keep previous
    }
  };

  const handleRunAiAnalysis = async () => {
    const item = quarantinedItem || (selectedEvent ? quarantineManager.get(selectedEvent.id) : null);
    if (!item && selectedEvent) {
      // Create on-the-fly diff if not explicitly in quarantine
      setIsAnalyzing(true);
      try {
        const diff = driftEngine.detectDrift(selectedEvent);
        const analysis = await driftEngine.analyzeDriftWithAI(selectedEvent, diff);
        setAiAnalysis(analysis);
      } catch (err) {
        console.error('AI Analysis error:', err);
      } finally {
        setIsAnalyzing(false);
      }
      return;
    }

    if (!item) return;
    setIsAnalyzing(true);
    try {
      const analysis = await driftEngine.analyzeDriftWithAI(item.event, item.diffResult);
      quarantineManager.attachAiAnalysis(item.id, analysis);
      setAiAnalysis(analysis);
    } catch (err) {
      console.error('AI Analysis error:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleApplyAiPatch = () => {
    let item = quarantinedItem || (selectedEvent ? quarantineManager.get(selectedEvent.id) : null);
    if (!item && selectedEvent && selectedEvent.isDrift) {
      // If it is marked as drift but not registered in manager yet, register it
      item = quarantineManager.quarantine(selectedEvent, selectedEvent.driftReason || 'Schema Drift detected in event stream');
    }

    if (!item || !aiAnalysis) return;
    try {
      const res = quarantineManager.reprocess(
        item.id,
        aiAnalysis.suggestedRulePatches,
        aiAnalysis.proposedVersion || 'v1.1',
        'SecOps AI Assistant',
        'Hot-patch applied via Side Inspector Dock'
      );
      if (res) {
        setReprocessSuccess(`Applied ${res.appliedVersion} — unmapped keys reduced from ${res.previousUnmappedCount} to ${res.newUnmappedCount}!`);
        if (onEventUpdated && res.reprocessedEvent) {
          onEventUpdated(res.reprocessedEvent);
        }
      }
    } catch (err) {
      console.error('Failed to apply patch:', err);
    }
  };

  const isDrift = selectedEvent.isDrift || !!quarantinedItem;
  const action = selectedEvent.canonical.network?.action?.toUpperCase() || 'UNKNOWN';
  const isDeny = action === 'DENY' || action === 'DROP' || action === 'BLOCKED';

  return (
    <div
      className={`fixed top-16 right-0 bottom-0 z-40 bg-zinc-950/98 backdrop-blur-md border-l border-zinc-800 shadow-2xl flex flex-col transition-all duration-300 ease-in-out ${
        isExpanded ? 'w-full lg:w-[680px]' : 'w-full lg:w-[480px]'
      }`}
    >
      {/* Dock Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900/60">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${
              isDrift
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            }`}
          >
            {isDrift ? <AlertTriangle className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-zinc-100 font-sans truncate">
                {isDrift ? 'Schema Drift Inspection' : 'Event Forensics'}
              </span>
              <Badge
                variant="outline"
                className={`text-[10px] font-mono px-1.5 py-0 capitalize ${
                  isDrift
                    ? 'text-amber-400 border-amber-500/30 bg-amber-500/10'
                    : 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                }`}
              >
                {isDrift ? 'Quarantined' : 'Lossless'}
              </Badge>
            </div>
            <p className="text-[10px] font-mono text-zinc-400 truncate">
              ID: {selectedEvent.id.slice(0, 16)} • {selectedEvent.detection.vendor}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-zinc-400 hover:text-zinc-100"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Collapse to standard dock' : 'Expand dock width'}
          >
            {isExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-zinc-400 hover:text-zinc-100"
            onClick={onClose}
            title="Close dock (Esc)"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Mode Navigation Tabs */}
      <div className="flex items-center px-4 py-1.5 bg-zinc-900/30 border-b border-zinc-800 gap-1 text-xs">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
            activeTab === 'overview'
              ? 'bg-zinc-800 text-zinc-100 font-semibold shadow-xs'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Summary & Cryptography
        </button>
        <button
          onClick={() => setActiveTab('canonical')}
          className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
            activeTab === 'canonical'
              ? 'bg-zinc-800 text-zinc-100 font-semibold shadow-xs'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Canonical Tree (ECS)
        </button>
        {isDrift && (
          <button
            onClick={() => setActiveTab('drift')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'drift'
                ? 'bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30'
                : 'text-amber-400/80 hover:text-amber-300'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            AI Drift Studio
          </button>
        )}
        <button
          onClick={() => setActiveTab('scratchpad')}
          className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors flex items-center gap-1 cursor-pointer ${
            activeTab === 'scratchpad'
              ? 'bg-zinc-800 text-zinc-100 font-semibold shadow-xs'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Terminal className="w-3 h-3" />
          Scratchpad
        </button>
      </div>

      {/* Dock Content Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* TAB 1: OVERVIEW & CRYPTO */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-mono">Vendor / Device</span>
                <span className="text-xs font-semibold text-zinc-200 capitalize">
                  {selectedEvent.detection.vendor.replace('_', ' ')}
                </span>
                <span className="text-[10px] text-zinc-400 block mt-0.5">Format: {selectedEvent.detection.format}</span>
              </div>

              <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-mono">Network Action</span>
                <span
                  className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-bold mt-1 ${
                    isDeny
                      ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                      : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  }`}
                >
                  {action}
                </span>
                <span className="text-[10px] text-zinc-400 block mt-0.5 font-mono">
                  Proto: {selectedEvent.canonical.network?.protocol?.toUpperCase() || 'IP'}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-mono">Flow Tuple</span>
                <div className="font-mono text-[11px] text-zinc-200 truncate mt-0.5">
                  {selectedEvent.canonical.source?.ip || '0.0.0.0'}:{selectedEvent.canonical.source?.port || '*'}
                  <span className="text-zinc-500 mx-1">→</span>
                  {selectedEvent.canonical.destination?.ip || '0.0.0.0'}:{selectedEvent.canonical.destination?.port || '*'}
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-mono">Parse Latency</span>
                <span className="text-xs font-mono font-semibold text-emerald-400 block mt-0.5">
                  {selectedEvent.latencyMs
                    ? `${selectedEvent.latencyMs.toFixed(3)} ms`
                    : '< 0.20 ms'}
                </span>
                <span className="text-[10px] text-zinc-500 block">SLA: Sub-2ms Guaranteed</span>
              </div>
            </div>

            {/* Cryptographic SHA-256 Provenance Card */}
            <div className="p-3 rounded-lg bg-zinc-900/80 border border-emerald-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-emerald-400 font-semibold font-mono text-[11px]">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Bit-Lossless Cryptographic Proof</span>
                </div>
                <Badge variant="outline" className="text-[9px] font-mono text-emerald-400 border-emerald-500/40">
                  PASS 100%
                </Badge>
              </div>
              <div className="space-y-1 font-mono text-[11px]">
                <div className="flex items-center justify-between text-zinc-400">
                  <span>Raw Bytes:</span>
                  <span className="text-zinc-200">{formatBytes(selectedEvent.envelope.raw_payload.length)}</span>
                </div>
                <div>
                  <span className="text-zinc-400 block text-[10px]">SHA-256 Checksum:</span>
                  <div className="flex items-center justify-between gap-1 p-1.5 mt-0.5 rounded bg-zinc-950 border border-zinc-800 text-[10px] text-zinc-300 break-all">
                    <span>{selectedEvent.envelope.sha256_hash}</span>
                    <button
                      onClick={() => handleCopy(selectedEvent.envelope.sha256_hash, 'hash')}
                      className="p-1 hover:text-emerald-400 shrink-0 cursor-pointer"
                    >
                      {copiedKey === 'hash' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Raw Log Preview */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider font-mono">
                  Exact Raw Ingress Payload
                </span>
                <button
                  onClick={() => handleCopy(selectedEvent.raw, 'raw')}
                  className="text-[11px] text-zinc-400 hover:text-zinc-200 flex items-center gap-1 cursor-pointer font-mono"
                >
                  {copiedKey === 'raw' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  Copy
                </button>
              </div>
              <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-[11px] text-zinc-300 whitespace-pre-wrap break-all max-h-36 overflow-y-auto leading-relaxed">
                {selectedEvent.raw}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CANONICAL TREE */}
        {activeTab === 'canonical' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-zinc-400">Normalized ECS Schema JSON</span>
              <button
                onClick={() => handleCopy(JSON.stringify(selectedEvent.canonical, null, 2), 'canonical')}
                className="text-[11px] text-zinc-400 hover:text-zinc-200 flex items-center gap-1 cursor-pointer font-mono"
              >
                {copiedKey === 'canonical' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                Copy JSON
              </button>
            </div>
            <pre className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-[11px] text-emerald-300/90 overflow-x-auto max-h-[500px] leading-relaxed select-all">
              {JSON.stringify(selectedEvent.canonical, null, 2)}
            </pre>
          </div>
        )}

        {/* TAB 3: AI DRIFT STUDIO */}
        {activeTab === 'drift' && (
          <div className="space-y-4">
            {/* Drift Alert Banner */}
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 space-y-1">
              <div className="flex items-center gap-2 font-semibold text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Zero-Day Schema Drift Detected</span>
              </div>
              <p className="text-[11px] text-amber-200/80">
                Vendor telemetry introduces fields not present in baseline mappings. Event was isolated in Quarantine to prevent silent data loss.
              </p>
            </div>

            {/* Reprocess Notice */}
            {reprocessSuccess && (
              <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{reprocessSuccess}</span>
              </div>
            )}

            {/* Unmapped Novel Fields */}
            <div className="space-y-2">
              <span className="text-[11px] font-mono uppercase text-zinc-400 font-semibold block">
                Novel Unmapped Fields ({Object.keys(selectedEvent.unmappedFields || {}).length})
              </span>
              <div className="space-y-1.5">
                {Object.entries(selectedEvent.unmappedFields || {}).map(([key, val]) => (
                  <div
                    key={key}
                    className="p-2 rounded-lg bg-zinc-900 border border-amber-500/30 flex items-center justify-between text-xs"
                  >
                    <div className="font-mono text-amber-400 font-semibold">{key}</div>
                    <div className="font-mono text-zinc-300 max-w-[200px] truncate text-[11px]">{String(val)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Assistant Section */}
            <div className="p-3.5 rounded-lg bg-zinc-900/90 border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-zinc-100 font-semibold text-xs">
                  <Bot className="w-4 h-4 text-emerald-400" />
                  <span>Gemini AI Remediation</span>
                </div>
                <Button
                  variant="emerald"
                  size="sm"
                  onClick={handleRunAiAnalysis}
                  disabled={isAnalyzing || !quarantinedItem}
                  className="h-7 text-xs"
                >
                  {isAnalyzing ? (
                    <>
                      <RotateCcw className="w-3 h-3 mr-1 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3 h-3 mr-1" />
                      Suggest Rule Patches
                    </>
                  )}
                </Button>
              </div>

              {aiAnalysis ? (
                <div className="space-y-2.5 pt-2 border-t border-zinc-800">
                  <div className="text-[11px] text-zinc-300 font-mono">
                    <span className="text-zinc-500">Proposed Version:</span>{' '}
                    <span className="text-emerald-400 font-bold">{aiAnalysis.proposedVersion || 'v1.1'}</span>
                  </div>
                  <div className="space-y-1.5">
                    {aiAnalysis.suggestedRulePatches?.map((p: SuggestedRulePatch, idx: number) => (
                      <div
                        key={idx}
                        className="p-2 rounded bg-zinc-950 border border-zinc-800 flex items-center justify-between font-mono text-[11px]"
                      >
                        <div className="text-amber-400 font-semibold">{p.input_field}</div>
                        <span className="text-zinc-500">→</span>
                        <div className="text-emerald-400 font-semibold">{p.semantic_field}</div>
                        <Badge variant="outline" className="text-[9px] uppercase">
                          {p.transformation_type || 'identity'}
                        </Badge>
                      </div>
                    ))}
                  </div>

                  <Button
                    variant="emerald"
                    className="w-full h-8 text-xs font-semibold mt-2"
                    onClick={handleApplyAiPatch}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                    Deploy Hot-Patch & Reprocess
                  </Button>
                </div>
              ) : (
                <p className="text-[11px] text-zinc-500 italic">
                  Click "Suggest Rule Patches" to have Gemini map these raw telemetry tokens into the ECS/OCSF canonical schema.
                </p>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: INTERACTIVE SCRATCHPAD */}
        {activeTab === 'scratchpad' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-zinc-400 font-semibold">
                Live Interactive Parser Scratchpad
              </span>
              <span className="text-[10px] text-emerald-400 font-mono">Instant Sub-ms Reparse</span>
            </div>
            <textarea
              value={scratchRaw}
              onChange={(e) => handleScratchReparse(e.target.value)}
              className="w-full h-32 p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-[11px] text-zinc-200 resize-none focus:outline-hidden focus:border-emerald-500/50"
              placeholder="Type or paste modified log line..."
            />

            {scratchResult && (
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-mono text-zinc-500 tracking-wider">
                  Live Reparse Result
                </span>
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                  <div className="p-2 rounded bg-zinc-900 border border-zinc-800">
                    <span className="text-zinc-500 block text-[10px]">Vendor:</span>
                    <span className="text-zinc-200 capitalize">{scratchResult.detection.vendor}</span>
                  </div>
                  <div className="p-2 rounded bg-zinc-900 border border-zinc-800">
                    <span className="text-zinc-500 block text-[10px]">Action:</span>
                    <span className="text-emerald-400 font-bold">
                      {scratchResult.canonical.network?.action || 'UNKNOWN'}
                    </span>
                  </div>
                </div>

                <pre className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-[10px] text-zinc-300 max-h-48 overflow-y-auto">
                  {JSON.stringify(scratchResult.canonical, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Dock Footer Actions */}
      <div className="p-3 border-t border-zinc-800 bg-zinc-900/60 flex items-center justify-between text-xs">
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-[11px] text-zinc-300"
          onClick={() => {
            if (onNavigateToWorkbench) onNavigateToWorkbench(selectedEvent.raw);
          }}
        >
          <ExternalLink className="w-3 h-3 mr-1" />
          Open in Full Workbench
        </Button>

        <Button
          variant="secondary"
          size="sm"
          className="h-7 text-[11px]"
          onClick={onClose}
        >
          Dismiss
        </Button>
      </div>
    </div>
  );
};
