/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Shield,
  ShieldAlert,
  AlertTriangle,
  Flame,
  Fingerprint,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  Layers,
  ArrowRight,
  Code2,
  Copy,
  Check,
  Zap,
  Play,
  FileJson,
  RotateCcw,
  Sliders,
  ChevronRight,
  Eye,
  Info,
  ExternalLink,
  Plus,
  Trash2,
  Send,
  Lock,
} from 'lucide-react';
import {
  QuarantinedEvent,
  QuarantineStatus,
  SuggestedRulePatch,
  PerimeterVendor,
  SchemaDiffToken,
  ProcessedStreamEvent,
} from '../../types.ts';
import { quarantineManager } from '../../services/quarantineManager.ts';
import { driftEngine } from '../../services/driftEngine.ts';
import { knowledgeRegistry } from '../../services/knowledgeRegistry.ts';
import { processRawEventThroughPipeline } from '../../services/streamSimulator.ts';

interface Phase5DriftConsoleProps {
  onOpenRegistry?: () => void;
  onOpenLiveStream?: () => void;
}

export const Phase5DriftConsole: React.FC<Phase5DriftConsoleProps> = ({
  onOpenRegistry,
  onOpenLiveStream,
}) => {
  // 1. Quarantined Events State
  const [quarantinedEvents, setQuarantinedEvents] = useState<QuarantinedEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  // 2. Filters & View State
  const [statusFilter, setStatusFilter] = useState<'ALL' | QuarantineStatus>('ALL');
  const [vendorFilter, setVendorFilter] = useState<'ALL' | PerimeterVendor>('ALL');
  const [showSandboxPromptModal, setShowSandboxPromptModal] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // 3. AI Execution State
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isReprocessing, setIsReprocessing] = useState<boolean>(false);
  const [reprocessSuccessMessage, setReprocessSuccessMessage] = useState<string | null>(null);

  // 4. Custom patch adjustments (allow user/analyst to tweak AI suggestions)
  const [editablePatches, setEditablePatches] = useState<SuggestedRulePatch[]>([]);
  const [targetVersionInput, setTargetVersionInput] = useState<string>('');

  // Subscribe to quarantine manager
  useEffect(() => {
    const unsubscribe = quarantineManager.subscribe((events) => {
      setQuarantinedEvents(events);
      if (events.length > 0 && !selectedEventId) {
        setSelectedEventId(events[0].id);
      }
    });
    return () => unsubscribe();
  }, [selectedEventId]);

  // Selected Quarantined Event
  const activeQuarantined = useMemo(() => {
    return quarantinedEvents.find((e) => e.id === selectedEventId) || quarantinedEvents[0] || null;
  }, [quarantinedEvents, selectedEventId]);

  // Synchronize AI patches into editable state when active quarantined event changes
  useEffect(() => {
    if (activeQuarantined?.aiAnalysis) {
      setEditablePatches([...activeQuarantined.aiAnalysis.suggestedRulePatches]);
      setTargetVersionInput(activeQuarantined.aiAnalysis.proposedVersion);
    } else if (activeQuarantined) {
      // Pre-populate heuristic rule proposals from diff tokens
      const heuristicPatches: SuggestedRulePatch[] = activeQuarantined.diffResult.tokens
        .filter((t) => t.status === 'NOVEL_UNMAPPED')
        .map((t) => ({
          input_field: t.token,
          semantic_field: t.suggestedTarget || `custom.${t.token.toLowerCase()}`,
          transformation_type:
            t.inferredType === 'enum'
              ? 'enum'
              : t.inferredType === 'port' || t.inferredType === 'integer'
              ? 'cast'
              : 'identity',
          confidence: 0.95,
          rationale: `Direct canonical alignment for ${t.inferredType} token '${t.token}'.`,
          sampleValue: t.sampleValue,
        }));
      setEditablePatches(heuristicPatches);

      const curParts = activeQuarantined.event.mapping.software_version.replace(/^v/, '').split('.');
      const minor = parseInt(curParts[1] || '0', 10) + 1;
      setTargetVersionInput(`v${curParts[0] || '1'}.${minor}`);
    }
  }, [activeQuarantined?.id, activeQuarantined?.aiAnalysis]);

  // Copy helper
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  // Run Gemini AI Analysis
  const handleRunAiAnalysis = async () => {
    if (!activeQuarantined) return;
    setIsAnalyzing(true);
    setReprocessSuccessMessage(null);

    try {
      quarantineManager.updateStatus(activeQuarantined.id, 'ANALYZING');
      const analysis = await driftEngine.analyzeDriftWithAI(
        activeQuarantined.event,
        activeQuarantined.diffResult
      );
      quarantineManager.attachAiAnalysis(activeQuarantined.id, analysis);
      setEditablePatches(analysis.suggestedRulePatches);
      setTargetVersionInput(analysis.proposedVersion);
    } catch (err) {
      console.error('AI Analysis failed:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 1-Click Reprocess
  const handleReprocess = () => {
    if (!activeQuarantined || editablePatches.length === 0) return;
    setIsReprocessing(true);

    try {
      const result = quarantineManager.reprocess(
        activeQuarantined.id,
        editablePatches,
        targetVersionInput || 'v1.1',
        'SecOps AI Drift Agent',
        `Automated 1-click reprocess via Simplifyr Drift Engine. Mapped novel tokens: ${editablePatches.map((p) => p.input_field).join(', ')}`
      );

      setReprocessSuccessMessage(result.message);
      setTimeout(() => setReprocessSuccessMessage(null), 6000);
    } catch (err) {
      console.error('Reprocess error:', err);
    } finally {
      setIsReprocessing(false);
    }
  };

  // Batch Reprocess All Quarantined Events sharing current fingerprint
  const handleBatchReprocessFingerprint = () => {
    if (!activeQuarantined) return;
    const sameFingerprintIds = quarantinedEvents
      .filter(
        (e) =>
          e.fingerprint.fingerprintHash === activeQuarantined.fingerprint.fingerprintHash &&
          e.status !== 'REPROCESSED'
      )
      .map((e) => e.id);

    if (sameFingerprintIds.length === 0) return;

    quarantineManager.reprocessBatch(
      sameFingerprintIds,
      editablePatches,
      targetVersionInput || 'v1.1',
      'SecOps AI Drift Agent'
    );

    setReprocessSuccessMessage(
      `Batch Reprocess Complete: Promoted ${sameFingerprintIds.length} event(s) sharing fingerprint ${activeQuarantined.fingerprint.fingerprintHash}.`
    );
    setTimeout(() => setReprocessSuccessMessage(null), 6000);
  };

  // Inject a synthetic drift event for live testing
  const handleInjectDriftEvent = (vendor: PerimeterVendor) => {
    let mockRaw = '';
    let unmapped: Record<string, unknown> = {};

    if (vendor === 'palo_alto') {
      mockRaw = `<14>1 ${new Date().toISOString()} pa-fw-edge PAN-OS - - [pan@2847 src=10.200.4.19 dst=172.67.180.12 spt=59201 dpt=443 proto=tcp act=allow ja4=t13d1516h2_8daaf6152771_b4b39b563456 app_category="cloud-storage" nat_translated_port=10492 flow_risk_score=24]`;
      unmapped = {
        ja4: 't13d1516h2_8daaf6152771_b4b39b563456',
        app_category: 'cloud-storage',
        nat_translated_port: 10492,
        flow_risk_score: 24,
      };
    } else if (vendor === 'cisco_asa') {
      mockRaw = `Sep 18 10:45:01 cisco-asa-edge %ASA-6-302013: Built outbound TCP connection 9821999 for outside:198.51.100.40/443 (198.51.100.40/443) to inside:10.10.8.99/50114 (nat_spt=18204 xlate_src=203.0.113.88 cloud_vpc_id="vpc-corp-asia")`;
      unmapped = {
        nat_spt: 18204,
        xlate_src: '203.0.113.88',
        cloud_vpc_id: 'vpc-corp-asia',
      };
    } else {
      mockRaw = `date=2026-09-18 time=10:45:30 devname="FGT-EDGE-02" type="traffic" srcip=10.2.1.88 srcport=48921 dstip=142.250.190.46 dstport=443 proto=6 action="accept" tls_cipher="TLS_CHACHA20_POLY1305_SHA256" threat_score=35 ja3="771,4865-4866,0-23-65281,29-23,0"`;
      unmapped = {
        tls_cipher: 'TLS_CHACHA20_POLY1305_SHA256',
        threat_score: 35,
        ja3: '771,4865-4866,0-23-65281,29-23,0',
      };
    }

    const mockEvent = processRawEventThroughPipeline(mockRaw, {
      isDrift: true,
      driftReason: `Injected synthetic drift with ${Object.keys(unmapped).length} unmapped novel tokens`,
    });
    mockEvent.unmappedFields = {
      ...mockEvent.unmappedFields,
      ...unmapped,
    };

    const q = quarantineManager.addEventFromStream(mockEvent);
    setSelectedEventId(q.id);
  };

  // Filtered quarantine list
  const filteredEvents = useMemo(() => {
    return quarantinedEvents.filter((item) => {
      if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;
      if (vendorFilter !== 'ALL' && item.event.detection.vendor !== vendorFilter) return false;
      return true;
    });
  }, [quarantinedEvents, statusFilter, vendorFilter]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = quarantinedEvents.length;
    const active = quarantinedEvents.filter((e) => e.status === 'QUARANTINED').length;
    const ready = quarantinedEvents.filter((e) => e.status === 'PATCH_READY').length;
    const reprocessed = quarantinedEvents.filter((e) => e.status === 'REPROCESSED').length;
    const fingerprints = new Set(quarantinedEvents.map((e) => e.fingerprint.fingerprintHash)).size;

    return { total, active, ready, reprocessed, fingerprints };
  }, [quarantinedEvents]);

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100 overflow-hidden font-sans">
      {/* =====================================================================
          TOP HEADER: DRIFT ENGINE CONTROL STRIP & STATS
          ===================================================================== */}
      <header className="px-5 py-3.5 bg-zinc-900/90 border-b border-zinc-800 shrink-0 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-xs">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold tracking-tight text-zinc-100">
                Phase 5: Autonomous Drift Engine & Quarantine Buffer
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-mono font-semibold">
                ACTIVE
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Structural Fingerprint Diffing • Prompt-Sandboxed Gemini AI • 1-Click Reprocess Workflow
            </p>
          </div>
        </div>

        {/* Live Metrics Counter */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="px-3 py-1.5 rounded-md bg-zinc-900 border border-zinc-800 flex items-center gap-2">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-zinc-400">In Quarantine:</span>
            <span className="text-amber-400 font-bold">{metrics.active}</span>
          </div>

          <div className="px-3 py-1.5 rounded-md bg-zinc-900 border border-zinc-800 flex items-center gap-2">
            <Fingerprint className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-zinc-400">Clusters:</span>
            <span className="text-cyan-400 font-bold">{metrics.fingerprints}</span>
          </div>

          <div className="px-3 py-1.5 rounded-md bg-zinc-900 border border-zinc-800 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-zinc-400">AI Patched:</span>
            <span className="text-purple-400 font-bold">{metrics.ready}</span>
          </div>

          <div className="px-3 py-1.5 rounded-md bg-zinc-900 border border-zinc-800 flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-zinc-400">Reprocessed:</span>
            <span className="text-emerald-400 font-bold">{metrics.reprocessed}</span>
          </div>

          {/* Quick Drift Injectors for testing */}
          <div className="flex items-center gap-1.5 border-l border-zinc-800 pl-3">
            <span className="text-[11px] text-zinc-400 font-sans">Simulate:</span>
            <button
              onClick={() => handleInjectDriftEvent('palo_alto')}
              className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] cursor-pointer transition-colors"
              title="Inject PAN-OS 11.0 drift event"
            >
              +PAN-OS
            </button>
            <button
              onClick={() => handleInjectDriftEvent('cisco_asa')}
              className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] cursor-pointer transition-colors"
              title="Inject Cisco ASA NAT drift event"
            >
              +Cisco
            </button>
            <button
              onClick={() => handleInjectDriftEvent('fortinet_fortigate')}
              className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] cursor-pointer transition-colors"
              title="Inject FortiOS TLS drift event"
            >
              +Fortinet
            </button>
          </div>
        </div>
      </header>

      {/* Reprocess Notification Banner */}
      {reprocessSuccessMessage && (
        <div className="px-5 py-2.5 bg-emerald-950/80 border-b border-emerald-800/80 text-emerald-200 text-xs flex items-center justify-between animate-in slide-in-from-top duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-semibold">{reprocessSuccessMessage}</span>
          </div>
          <button
            onClick={() => setReprocessSuccessMessage(null)}
            className="text-emerald-400 hover:text-emerald-200 text-xs font-mono cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* =====================================================================
          MAIN 3-PANE WORKBENCH:
          PANE 1: Quarantine Buffer & Fingerprint Clusters (280px)
          PANE 2: Structural Fingerprint Diffing Engine (Flex 1)
          PANE 3: Gemini AI Remediation & 1-Click Reprocess (420px)
          ===================================================================== */}
      <div className="flex-1 flex overflow-hidden">
        {/* ===================================================================
            PANE 1: QUARANTINE BUFFER LIST
            =================================================================== */}
        <aside className="w-72 border-r border-zinc-800 bg-zinc-950/80 flex flex-col shrink-0">
          {/* Filter Bar */}
          <div className="p-3 border-b border-zinc-800 space-y-2 bg-zinc-900/50">
            <div className="flex items-center justify-between text-xs font-bold text-zinc-300">
              <span className="flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                Quarantine Queue ({filteredEvents.length})
              </span>
              <button
                onClick={() => quarantineManager.clearResolved()}
                className="text-[10px] text-zinc-400 hover:text-zinc-200 font-mono cursor-pointer"
                title="Clear reprocessed events from view"
              >
                Clear Resolved
              </button>
            </div>

            {/* Status Pills */}
            <div className="flex items-center gap-1 text-[10px] font-mono">
              {(['ALL', 'QUARANTINED', 'PATCH_READY', 'REPROCESSED'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                    statusFilter === st
                      ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40'
                      : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                  }`}
                >
                  {st === 'ALL' ? 'ALL' : st.replace('_', ' ')}
                </button>
              ))}
            </div>

            {/* Vendor Pills */}
            <div className="flex items-center gap-1 text-[10px] font-mono overflow-x-auto pb-0.5 scrollbar-none">
              {(['ALL', 'palo_alto', 'cisco_asa', 'fortinet_fortigate'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setVendorFilter(v)}
                  className={`px-1.5 py-0.5 rounded cursor-pointer whitespace-nowrap ${
                    vendorFilter === v
                      ? 'bg-zinc-700 text-white font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {v === 'ALL' ? 'Vendors: All' : v.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Quarantine Items Scroll List */}
          <div className="flex-1 overflow-y-auto divide-y divide-zinc-900">
            {filteredEvents.length === 0 ? (
              <div className="p-8 text-center text-zinc-400 text-xs space-y-2">
                <CheckCircle2 className="w-6 h-6 text-emerald-500/60 mx-auto" />
                <p>Quarantine Buffer Empty for selected filters.</p>
              </div>
            ) : (
              filteredEvents.map((item) => {
                const isSelected = item.id === activeQuarantined?.id;
                const unmappedKeys = Object.keys(item.event.unmappedFields);
                const isReprocessed = item.status === 'REPROCESSED';
                const isReady = item.status === 'PATCH_READY';

                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedEventId(item.id)}
                    className={`p-3 text-xs cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-amber-500/10 border-l-2 border-amber-400'
                        : 'hover:bg-zinc-900/60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-zinc-200 font-mono">
                        {item.event.detection.vendor.toUpperCase()}
                      </span>
                      <span
                        className={`text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded border ${
                          isReprocessed
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : isReady
                            ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>

                    <div className="text-[11px] text-zinc-400 truncate mb-1">
                      {item.quarantineReason}
                    </div>

                    {/* Novel Token Chips */}
                    <div className="flex flex-wrap gap-1 mb-1.5">
                      {unmappedKeys.map((k) => (
                        <span
                          key={k}
                          className="px-1.5 py-0.2 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono text-[9px]"
                        >
                          +{k}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
                      <span className="flex items-center gap-1">
                        <Fingerprint className="w-2.5 h-2.5 text-zinc-400" />
                        {item.fingerprint.fingerprintHash.substring(0, 16)}...
                      </span>
                      <span className="text-zinc-400">
                        {item.diffResult.driftSeverity} ({Math.round(item.diffResult.driftScore * 100)}%)
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* ===================================================================
            PANE 2: STRUCTURAL FINGERPRINT DIFFING ENGINE
            =================================================================== */}
        <section className="flex-1 flex flex-col border-r border-zinc-800 bg-zinc-950 overflow-y-auto">
          {activeQuarantined ? (
            <div className="p-5 space-y-5">
              {/* Header: Event Identification & Drift Assessment Banner */}
              <div className="p-4 rounded-lg bg-zinc-900/90 border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Fingerprint className="w-5 h-5 text-cyan-400" />
                    <div>
                      <h2 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                        Structural Fingerprint:{' '}
                        <span className="font-mono text-cyan-400">
                          {activeQuarantined.fingerprint.fingerprintHash}
                        </span>
                      </h2>
                      <div className="text-xs text-zinc-400">
                        Active Base Mapping:{' '}
                        <span className="text-zinc-200 font-mono font-semibold">
                          {activeQuarantined.diffResult.baseMappingId}
                        </span>{' '}
                        (Ver: {activeQuarantined.diffResult.baseVersion})
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-mono font-bold px-2.5 py-1 rounded border ${
                        activeQuarantined.diffResult.driftSeverity === 'CRITICAL'
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                          : activeQuarantined.diffResult.driftSeverity === 'HIGH'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
                      }`}
                    >
                      DRIFT: {activeQuarantined.diffResult.driftSeverity} (
                      {Math.round(activeQuarantined.diffResult.driftScore * 100)}%)
                    </span>

                    <span className="text-xs font-mono px-2 py-1 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                      {activeQuarantined.diffResult.assessment}
                    </span>
                  </div>
                </div>

                {/* Diff Metric Bar */}
                <div className="grid grid-cols-3 gap-3 pt-2 border-t border-zinc-800/80 text-center">
                  <div className="p-2 rounded bg-zinc-950/60 border border-zinc-800">
                    <div className="text-[10px] text-zinc-400 font-mono">MATCHED TOKENS</div>
                    <div className="text-base font-bold text-emerald-400 font-mono">
                      {activeQuarantined.diffResult.matchedCount}
                    </div>
                  </div>
                  <div className="p-2 rounded bg-zinc-950/60 border border-zinc-800">
                    <div className="text-[10px] text-zinc-400 font-mono">NOVEL UNMAPPED TOKENS</div>
                    <div className="text-base font-bold text-amber-400 font-mono">
                      {activeQuarantined.diffResult.novelCount}
                    </div>
                  </div>
                  <div className="p-2 rounded bg-zinc-950/60 border border-zinc-800">
                    <div className="text-[10px] text-zinc-400 font-mono">MISSING MANDATORY</div>
                    <div className="text-base font-bold text-zinc-300 font-mono">
                      {activeQuarantined.diffResult.missingCount}
                    </div>
                  </div>
                </div>
              </div>

              {/* Raw Wire Envelope Sample */}
              <div className="rounded-lg border border-zinc-800 overflow-hidden">
                <div className="px-3.5 py-2 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between text-xs font-semibold text-zinc-300">
                  <span className="flex items-center gap-1.5">
                    <Code2 className="w-3.5 h-3.5 text-zinc-400" />
                    Observed Perimeter Wire Event
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopy(activeQuarantined.event.raw, 'raw')}
                      className="flex items-center gap-1 text-[11px] font-mono text-zinc-400 hover:text-zinc-200 cursor-pointer"
                    >
                      {copiedKey === 'raw' ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      Copy Raw
                    </button>
                    <button
                      onClick={() => setShowSandboxPromptModal(true)}
                      className="flex items-center gap-1 text-[11px] font-mono text-purple-400 hover:text-purple-300 cursor-pointer"
                    >
                      <Lock className="w-3 h-3" />
                      Inspect Prompt Sandbox
                    </button>
                  </div>
                </div>
                <div className="p-3 bg-zinc-950 text-xs font-mono text-zinc-300 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
                  {activeQuarantined.event.raw}
                </div>
              </div>

              {/* Structural Token Diff Table */}
              <div className="rounded-lg border border-zinc-800 overflow-hidden">
                <div className="px-3.5 py-2.5 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between text-xs font-semibold text-zinc-300">
                  <span className="flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-zinc-400" />
                    Extracted Wire Tokens vs Base Schema Rules
                  </span>
                  <span className="text-[10px] text-zinc-400 font-mono">
                    Total: {activeQuarantined.diffResult.tokens.length} tokens
                  </span>
                </div>

                <div className="divide-y divide-zinc-900 bg-zinc-950">
                  {activeQuarantined.diffResult.tokens.map((tok) => {
                    const isNovel = tok.status === 'NOVEL_UNMAPPED';
                    const isMissing = tok.status === 'MISSING_EXPECTED';

                    return (
                      <div
                        key={tok.token}
                        className={`px-3.5 py-2.5 flex items-center justify-between gap-4 text-xs font-mono transition-colors ${
                          isNovel ? 'bg-amber-500/5' : isMissing ? 'bg-rose-500/5' : ''
                        }`}
                      >
                        {/* Token Name & Observed Sample */}
                        <div className="space-y-0.5 min-w-[140px]">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`font-bold ${
                                isNovel
                                  ? 'text-amber-300'
                                  : isMissing
                                  ? 'text-rose-400 line-through'
                                  : 'text-zinc-200'
                              }`}
                            >
                              {tok.token}
                            </span>
                            {tok.inferredType && (
                              <span className="text-[9px] px-1 py-0.2 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
                                {tok.inferredType}
                              </span>
                            )}
                          </div>
                          {tok.sampleValue !== undefined && (
                            <div className="text-[11px] text-zinc-400 truncate max-w-xs">
                              val: <span className="text-zinc-300">"{String(tok.sampleValue)}"</span>
                            </div>
                          )}
                        </div>

                        {/* Middle: Arrow & Target */}
                        <div className="flex-1 flex items-center gap-2">
                          <ArrowRight className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                          {isNovel ? (
                            <span className="text-amber-400 font-semibold">
                              [Unmapped Drift] → Target:{' '}
                              <span className="text-amber-300 underline underline-offset-2">
                                {tok.suggestedTarget || 'unassigned'}
                              </span>
                            </span>
                          ) : isMissing ? (
                            <span className="text-rose-400">
                              Missing from wire payload (expected {tok.mappedTo})
                            </span>
                          ) : (
                            <span className="text-emerald-400">
                              {tok.mappedTo}{' '}
                              <span className="text-zinc-400 text-[10px]">
                                ({tok.ruleType || 'identity'}, {Math.round((tok.confidence || 1) * 100)}% conf)
                              </span>
                            </span>
                          )}
                        </div>

                        {/* Status Badge */}
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-bold border ${
                            isNovel
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              : isMissing
                              ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          }`}
                        >
                          {tok.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Batch Action Option */}
              <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 flex items-center justify-between text-xs">
                <div className="text-zinc-300">
                  <span className="font-semibold">Cluster Batching:</span>{' '}
                  <span className="text-zinc-400">
                    {
                      quarantinedEvents.filter(
                        (e) =>
                          e.fingerprint.fingerprintHash ===
                            activeQuarantined.fingerprint.fingerprintHash &&
                          e.status !== 'REPROCESSED'
                      ).length
                    }{' '}
                    quarantined events share this structural fingerprint.
                  </span>
                </div>
                <button
                  onClick={handleBatchReprocessFingerprint}
                  disabled={isReprocessing || editablePatches.length === 0}
                  className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-semibold cursor-pointer disabled:opacity-50 transition-colors"
                >
                  Batch Reprocess Fingerprint Cluster
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-zinc-400 text-xs">
              Select a quarantined event to inspect structural diff.
            </div>
          )}
        </section>

        {/* ===================================================================
            PANE 3: GEMINI AI REMEDIATION & 1-CLICK REPROCESS CHAMBER
            =================================================================== */}
        <aside className="w-96 bg-zinc-950 flex flex-col shrink-0 overflow-y-auto">
          {activeQuarantined ? (
            <div className="p-5 space-y-5">
              {/* Chamber Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-md bg-purple-500/10 border border-purple-500/30 text-purple-400 flex items-center justify-center">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-zinc-200">
                      Gemini AI Remediation Service
                    </h3>
                    <p className="text-[10px] text-zinc-400">gemini-3.8-flash (Prompt-Sandboxed)</p>
                  </div>
                </div>

                <button
                  onClick={handleRunAiAnalysis}
                  disabled={isAnalyzing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold cursor-pointer transition-colors disabled:opacity-50 shadow-xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
                  {isAnalyzing ? 'Analyzing...' : 'Run AI Analysis'}
                </button>
              </div>

              {/* AI Analysis Card */}
              {activeQuarantined.aiAnalysis ? (
                <div className="space-y-4">
                  {/* Summary & Root Cause */}
                  <div className="p-3.5 rounded-lg bg-zinc-900/90 border border-zinc-800 space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-purple-400 font-bold">
                        Model: {activeQuarantined.aiAnalysis.modelUsed}
                      </span>
                      <span className="text-zinc-400">
                        {activeQuarantined.aiAnalysis.executionTimeMs}ms
                      </span>
                    </div>

                    <div className="text-xs text-zinc-200 font-semibold leading-relaxed">
                      {activeQuarantined.aiAnalysis.summary}
                    </div>

                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      {activeQuarantined.aiAnalysis.rootCauseAnalysis}
                    </p>

                    <div className="pt-2 border-t border-zinc-800 text-[10px] font-mono text-zinc-400 flex items-center gap-1">
                      <Shield className="w-3 h-3 text-emerald-400" />
                      <span>{activeQuarantined.aiAnalysis.securityRiskAssessment}</span>
                    </div>
                  </div>

                  {/* Proposed Version & Rule Patches */}
                  <div className="p-3.5 rounded-lg bg-zinc-900/90 border border-zinc-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-zinc-200">
                        Proposed Version Patch
                      </span>
                      <div className="flex items-center gap-1 font-mono text-xs">
                        <span className="text-zinc-400">Target:</span>
                        <input
                          type="text"
                          value={targetVersionInput}
                          onChange={(e) => setTargetVersionInput(e.target.value)}
                          className="w-16 px-1.5 py-0.5 rounded bg-zinc-950 border border-zinc-700 text-purple-300 font-bold text-xs"
                        />
                      </div>
                    </div>

                    {/* Rule Patch List */}
                    <div className="space-y-2">
                      {editablePatches.map((patch, idx) => (
                        <div
                          key={patch.input_field}
                          className="p-2.5 rounded bg-zinc-950 border border-zinc-800 space-y-1.5 text-xs font-mono"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-amber-400 font-bold font-mono">
                              +{patch.input_field}
                            </span>
                            <span className="text-[10px] text-zinc-400">
                              {Math.round(patch.confidence * 100)}% conf
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className="text-zinc-400 text-[10px]">maps to:</span>
                            <input
                              type="text"
                              value={patch.semantic_field}
                              onChange={(e) => {
                                const val = e.target.value;
                                setEditablePatches((prev) =>
                                  prev.map((p, i) =>
                                    i === idx ? { ...p, semantic_field: val } : p
                                  )
                                );
                              }}
                              className="flex-1 px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-emerald-400 text-xs font-mono font-semibold"
                            />
                          </div>

                          <div className="text-[10px] text-zinc-400 italic">
                            {patch.rationale}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 1-CLICK REPROCESS BUTTON */}
                  <div className="space-y-2 pt-2">
                    <button
                      onClick={handleReprocess}
                      disabled={isReprocessing || editablePatches.length === 0}
                      className="w-full py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <Zap className={`w-4 h-4 ${isReprocessing ? 'animate-spin' : ''}`} />
                      {isReprocessing
                        ? 'Reprocessing Event...'
                        : '1-Click: Apply Patch & Reprocess Event'}
                    </button>

                    <p className="text-[10px] text-zinc-400 text-center">
                      Registers {targetVersionInput} in Knowledge Registry, re-normalizes envelope,
                      and guarantees 100% cryptographic lossless provenance.
                    </p>
                  </div>
                </div>
              ) : (
                /* Pre-Analysis State: Instant Patch Proposals available */
                <div className="space-y-4">
                  <div className="p-3.5 rounded-lg bg-zinc-900 border border-zinc-800 space-y-2">
                    <div className="text-xs font-bold text-zinc-200">
                      Heuristic Schema Alignment
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      Simplifyr has pre-calculated canonical mappings for all unmapped tokens based
                      on ULPF lexical heuristics. You can run Gemini 3.8 Flash for deep vendor
                      context or apply immediately:
                    </p>
                  </div>

                  {/* Editable Patches */}
                  <div className="space-y-2">
                    {editablePatches.map((patch, idx) => (
                      <div
                        key={patch.input_field}
                        className="p-2.5 rounded bg-zinc-950 border border-zinc-800 space-y-1 text-xs font-mono"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-amber-400 font-bold">+{patch.input_field}</span>
                          <span className="text-[10px] text-zinc-400">Heuristic</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-zinc-400 text-[10px]">→</span>
                          <input
                            type="text"
                            value={patch.semantic_field}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditablePatches((prev) =>
                                prev.map((p, i) => (i === idx ? { ...p, semantic_field: val } : p))
                              );
                            }}
                            className="flex-1 px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-emerald-400 text-xs font-mono font-semibold"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 1-Click Reprocess */}
                  <button
                    onClick={handleReprocess}
                    disabled={isReprocessing || editablePatches.length === 0}
                    className="w-full py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Zap className="w-4 h-4" />
                    Apply & Reprocess Now
                  </button>
                </div>
              )}

              {/* Reprocessed Event Result Card */}
              {activeQuarantined.status === 'REPROCESSED' && activeQuarantined.reprocessedEvent && (
                <div className="p-3.5 rounded-lg bg-emerald-950/40 border border-emerald-800/60 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Reprocess Complete (100% Lossless)
                  </div>
                  <div className="text-[11px] text-zinc-300 font-mono space-y-1">
                    <div>
                      Promoted Version:{' '}
                      <span className="text-emerald-400 font-bold">
                        {activeQuarantined.appliedPatchVersion}
                      </span>
                    </div>
                    <div>
                      Previous Unmapped:{' '}
                      <span className="text-amber-400">
                        {Object.keys(activeQuarantined.event.unmappedFields).length}
                      </span>{' '}
                      → Now: <span className="text-emerald-400 font-bold">0</span>
                    </div>
                    <div className="truncate text-zinc-400 text-[10px]">
                      Seal: {activeQuarantined.reprocessedEvent.provenance.sha256_hash}
                    </div>
                  </div>

                  {onOpenRegistry && (
                    <button
                      onClick={onOpenRegistry}
                      className="w-full mt-2 py-1 px-2 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-[11px] font-mono flex items-center justify-center gap-1 border border-zinc-800 cursor-pointer"
                    >
                      <Layers className="w-3 h-3 text-purple-400" />
                      View Updated Knowledge Registry
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 text-center text-zinc-400 text-xs">
              No quarantined event selected.
            </div>
          )}
        </aside>
      </div>

      {/* =====================================================================
          PROMPT SANDBOX INSPECTOR MODAL
          ===================================================================== */}
      {showSandboxPromptModal && activeQuarantined && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
            <header className="px-5 py-3.5 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-purple-400" />
                <h3 className="text-xs font-bold text-zinc-100">
                  Prompt Sandboxing & Isolation Chamber
                </h3>
              </div>
              <button
                onClick={() => setShowSandboxPromptModal(false)}
                className="text-zinc-400 hover:text-zinc-200 text-xs font-mono cursor-pointer"
              >
                Close (ESC)
              </button>
            </header>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2">
                <div className="text-zinc-300 font-semibold">Security Sandboxing Directives:</div>
                <ul className="list-disc pl-4 text-zinc-400 text-[11px] space-y-1">
                  <li>Untrusted raw wire logs are enclosed inside unique nonces.</li>
                  <li>Delimiters, backticks, and escape sequences are neutralized.</li>
                  <li>System prompts strictly forbid model code or instruction execution.</li>
                </ul>
              </div>

              <div className="space-y-1.5">
                <div className="text-zinc-300 font-semibold">Sandboxed Prompt Output:</div>
                <div className="p-3 bg-zinc-950 rounded border border-zinc-800 font-mono text-[11px] text-zinc-300 max-h-72 overflow-y-auto whitespace-pre-wrap">
                  {
                    driftEngine.sandboxRawPayload(activeQuarantined.event.raw, {
                      vendor: activeQuarantined.event.detection.vendor,
                      unmappedKeys: Object.keys(activeQuarantined.event.unmappedFields),
                    }).sandboxedPromptText
                  }
                </div>
              </div>
            </div>

            <footer className="p-3 bg-zinc-950 border-t border-zinc-800 flex justify-end">
              <button
                onClick={() => setShowSandboxPromptModal(false)}
                className="px-4 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold cursor-pointer"
              >
                Done
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
};
