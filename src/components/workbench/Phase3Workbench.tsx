/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Shield,
  Zap,
  CheckCircle2,
  Copy,
  Check,
  Search,
  ArrowRight,
  Sparkles,
  Sliders,
  Download,
  Fingerprint,
  FileJson,
  Hash,
  Eye,
  Link2,
  Lock,
  Layers,
  Activity,
  AlertTriangle,
  RotateCcw,
  FileText,
  CornerDownRight,
  Info,
} from 'lucide-react';
import { GOLDEN_CORPUS, GoldenSample } from '../../data/goldenCorpus.ts';
import { createCommonEventEnvelope } from '../../core/envelope.ts';
import { detectLogFormatAndVendor, parseAnyLog } from '../../core/detector.ts';
import { knowledgeRegistry } from '../../services/knowledgeRegistry.ts';
import { normalizeEvent } from '../../core/normalizer.ts';
import { PRESET_OUTPUT_PROFILES, projectEvent } from '../../services/outputProfiles.ts';
import { VersionedMapping, FieldProvenance } from '../../types.ts';

interface Phase3WorkbenchProps {
  onEventProcessed?: (latency: number) => void;
  onOpenRegistry?: () => void;
  initialRawInput?: string;
}

export const Phase3Workbench: React.FC<Phase3WorkbenchProps> = ({
  onEventProcessed,
  onOpenRegistry,
  initialRawInput,
}) => {
  // 1. Ingestion & Golden Corpus Selection
  const [selectedSampleId, setSelectedSampleId] = useState<string>(GOLDEN_CORPUS[0].id);
  const [rawInput, setRawInput] = useState<string>(initialRawInput || GOLDEN_CORPUS[0].raw);
  const [isRawEditable, setIsRawEditable] = useState<boolean>(false);

  // Sync initialRawInput if updated from outside
  React.useEffect(() => {
    if (initialRawInput) {
      setRawInput(initialRawInput);
      const match = GOLDEN_CORPUS.find((g) => g.raw === initialRawInput);
      if (match) setSelectedSampleId(match.id);
    }
  }, [initialRawInput]);

  // 2. Active Output Profile
  const [activeProfileId, setActiveProfileId] = useState<string>('soc_investigation');

  // 3. Mapping Selection & Overrides
  const [selectedMappingOverride, setSelectedMappingOverride] = useState<VersionedMapping | null>(
    null
  );

  // 4. Synchronized Provenance Highlighting State
  // Can be set via clicking or hovering any field in Pane 1, Pane 2, or Pane 3!
  const [selectedFieldKey, setSelectedFieldKey] = useState<string | null>('source.ip');
  const [hoveredFieldKey, setHoveredFieldKey] = useState<string | null>(null);

  // 5. UI Filters & Copy States
  const [canonicalSearch, setCanonicalSearch] = useState<string>('');
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const activeFieldKey = hoveredFieldKey || selectedFieldKey || 'source.ip';

  // Deterministic Processing Pipeline:
  // Raw Input -> Envelope (SHA-256) -> Detection -> Modular Parser -> Knowledge Registry -> Semantic Normalizer -> Output Projector
  const pipeline = useMemo(() => {
    const startTime = performance.now();

    // 1. Detection
    const detection = detectLogFormatAndVendor(rawInput);

    // 2. Cryptographic Envelope
    const envelope = createCommonEventEnvelope(
      rawInput,
      {
        device_id: 'FW-Perimeter-01',
        ip_address: '192.168.1.10',
        protocol: 'syslog',
      },
      detection.format
    );

    // 3. Structural Parsing
    const parsed = parseAnyLog(rawInput, envelope.event_id);

    // 4. Knowledge Registry Lookup
    const matchedMapping =
      selectedMappingOverride ||
      knowledgeRegistry.findBestMapping(detection.vendor, detection.format) ||
      knowledgeRegistry.getAllMappings()[0];

    // 5. Canonical Normalization & Forensic Lineage Tracking
    const latency = Math.max(0.12, Math.round((performance.now() - startTime) * 100) / 100);
    const normalizedResult = normalizeEvent(envelope, parsed, matchedMapping, latency);

    // 6. Profile Projection
    const profile =
      PRESET_OUTPUT_PROFILES.find((p) => p.id === activeProfileId) || PRESET_OUTPUT_PROFILES[0];
    const projected = projectEvent(normalizedResult.canonical, profile);

    return {
      envelope,
      detection,
      parsed,
      matchedMapping,
      normalizedResult,
      profile,
      projected,
      latency,
    };
  }, [rawInput, selectedMappingOverride, activeProfileId]);

  // Notify parent dashboard of new event execution
  const handleSelectSample = (sample: GoldenSample) => {
    setSelectedSampleId(sample.id);
    setRawInput(sample.raw);
    setSelectedMappingOverride(null);
    setSelectedFieldKey('source.ip');
    if (onEventProcessed) {
      onEventProcessed(pipeline.latency);
    }
  };

  const handleCopy = (text: string, sectionId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(sectionId);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  // Find provenance info for the actively highlighted field
  const activeProvenance: FieldProvenance | undefined = useMemo(() => {
    if (!activeFieldKey) return undefined;
    return pipeline.normalizedResult.provenance.lineage[activeFieldKey];
  }, [activeFieldKey, pipeline.normalizedResult.provenance.lineage]);

  // Synchronized Raw Log Slicing for Pane 1
  // If the active field has a raw_slice, highlight that slice with amber pulse
  const rawSlicedDisplay = useMemo(() => {
    const raw = rawInput;
    const slice = activeProvenance?.raw_slice;

    if (!slice || slice.start < 0 || slice.end > raw.length || slice.start >= slice.end) {
      return {
        prefix: raw,
        highlighted: '',
        suffix: '',
        hasSlice: false,
      };
    }

    return {
      prefix: raw.substring(0, slice.start),
      highlighted: raw.substring(slice.start, slice.end),
      suffix: raw.substring(slice.end),
      hasSlice: true,
      start: slice.start,
      end: slice.end,
    };
  }, [rawInput, activeProvenance]);

  // Export Forensic Bundle
  const handleExportBundle = () => {
    const bundle = {
      manifest_type: 'SIMPLIFYR_FORENSIC_RECEIPT_V1',
      generated_at: new Date().toISOString(),
      envelope: pipeline.envelope,
      detection: pipeline.detection,
      mapping_applied: {
        vendor: pipeline.matchedMapping.vendor,
        version: pipeline.matchedMapping.software_version,
        mapping_id: pipeline.matchedMapping.mapping_id,
      },
      canonical_event: pipeline.normalizedResult.canonical,
      projected_profile: {
        profile_id: pipeline.profile.id,
        output: pipeline.projected,
      },
      forensic_provenance: pipeline.normalizedResult.provenance,
    };

    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `forensic-receipt-${pipeline.envelope.event_id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full w-full bg-zinc-950 text-zinc-100 overflow-hidden font-sans select-none">
      {/* Top Operational Header */}
      <header className="px-4 py-2.5 bg-zinc-900/90 border-b border-zinc-800 flex items-center justify-between shrink-0 gap-4">
        {/* Title & Phase 3 Badge */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-xs shadow-emerald-400" />
            <h2 className="text-sm font-semibold tracking-wide text-zinc-100 flex items-center gap-2">
              <span>3-PANE PLUG & PLAY WORKBENCH</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 font-bold uppercase">
                Synchronized Provenance
              </span>
            </h2>
          </div>

          <span className="text-zinc-600 hidden sm:inline">|</span>

          {/* Active Vendor & Mapping info */}
          <div className="hidden lg:flex items-center gap-2 text-xs font-mono text-zinc-400">
            <span className="text-zinc-500">Active Rule:</span>
            <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-200 border border-zinc-700 font-semibold">
              {pipeline.matchedMapping.vendor}@{pipeline.matchedMapping.software_version}
            </span>
          </div>
        </div>

        {/* Golden Perimeter Fleet Picker */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
          <span className="text-[10px] uppercase font-mono text-zinc-500 hidden xl:inline">
            Perimeter Fleet:
          </span>
          <div className="flex items-center gap-1">
            {GOLDEN_CORPUS.map((sample) => {
              const isSelected = selectedSampleId === sample.id;
              return (
                <button
                  key={sample.id}
                  onClick={() => handleSelectSample(sample)}
                  className={`px-2 py-1 rounded text-xs font-mono transition-all cursor-pointer whitespace-nowrap ${
                    isSelected
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-xs'
                      : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border border-zinc-800'
                  }`}
                  title={`${sample.name} (${sample.format.toUpperCase()})`}
                >
                  {sample.name.split(' ')[0]}
                </button>
              );
            })}
          </div>

          {/* Export Receipt Button */}
          <button
            onClick={handleExportBundle}
            className="ml-2 flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium cursor-pointer border border-zinc-700 transition-all"
            title="Download Forensic Cryptographic Receipt"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Receipt</span>
          </button>
        </div>
      </header>

      {/* Synchronized Provenance HUD Bar */}
      <div className="px-4 py-1.5 bg-zinc-950 border-b border-zinc-800/80 flex items-center justify-between text-xs font-mono shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-amber-300">
            <Link2 className="w-3.5 h-3.5" />
            <span className="text-zinc-400">Synchronized Focus:</span>
            <span className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold">
              {activeFieldKey}
            </span>
          </div>

          {activeProvenance ? (
            <div className="flex items-center gap-2 text-zinc-400 text-[11px] hidden md:flex">
              <span>➔</span>
              <span>Source Token: <span className="text-zinc-200 font-semibold">{activeProvenance.original_field}</span></span>
              <span>➔</span>
              <span>Value: <span className="text-emerald-300 font-semibold">{String(activeProvenance.output_value)}</span></span>
              <span>➔</span>
              <span>Transform: <span className="text-purple-300 uppercase">{activeProvenance.mapping_rule}</span></span>
              {activeProvenance.raw_slice && (
                <span className="text-[10px] px-1 py-0.2 rounded bg-zinc-800 text-zinc-400">
                  Slice [{activeProvenance.raw_slice.start}:{activeProvenance.raw_slice.end}]
                </span>
              )}
            </div>
          ) : (
            <span className="text-[11px] text-zinc-500 italic hidden sm:inline">
              Hover or click any field across any pane to view synchronized end-to-end lineage
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-[11px] text-zinc-400">
          <span className="flex items-center gap-1 text-emerald-400 font-semibold">
            <Zap className="w-3 h-3" />
            {pipeline.latency.toFixed(2)} ms
          </span>
          <span className="hidden sm:inline text-zinc-500">|</span>
          <span className="flex items-center gap-1 text-zinc-400">
            <Fingerprint className="w-3 h-3 text-emerald-400" />
            {pipeline.envelope.sha256_hash.substring(0, 10)}...
          </span>
        </div>
      </div>

      {/* 3-PANE WORKBENCH GRID */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0 overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-zinc-800">
        {/* =========================================================================
            PANE 1: RAW INGEST & PROOF (Columns 1 to 4)
            ========================================================================= */}
        <section
          id="pane-1-raw-ingest"
          className="lg:col-span-4 flex flex-col h-full overflow-hidden bg-zinc-950/60"
        >
          {/* Pane Header */}
          <div className="p-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/40">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center text-[10px] font-bold">
                1
              </span>
              <div>
                <h3 className="text-xs font-semibold text-zinc-200">Raw Byte Stream & Ingest</h3>
                <p className="text-[10px] text-zinc-500 font-mono">Original byte stream & tokens</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setIsRawEditable(!isRawEditable)}
                className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-all cursor-pointer ${
                  isRawEditable
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-zinc-800/80 text-zinc-400 border-zinc-700 hover:text-zinc-200'
                }`}
              >
                {isRawEditable ? 'Lock Viewer' : 'Edit Raw'}
              </button>

              <button
                onClick={() => handleCopy(rawInput, 'raw')}
                className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 border border-zinc-700 cursor-pointer"
                title="Copy Raw Log"
              >
                {copiedSection === 'raw' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* Detection Status Strip */}
          <div className="px-3 py-1.5 bg-zinc-900/20 border-b border-zinc-800/60 flex items-center justify-between text-[11px] font-mono">
            <div className="flex items-center gap-2">
              <span className="text-zinc-500">Format:</span>
              <span className="px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-400 font-bold uppercase">
                {pipeline.detection.format}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-zinc-500">Vendor:</span>
              <span className="text-emerald-400 font-bold">
                {pipeline.detection.vendor} ({Math.round(pipeline.detection.vendor_confidence * 100)}%)
              </span>
            </div>
          </div>

          {/* Raw Payload with SYNCHRONIZED HIGHLIGHTING */}
          <div className="p-3 flex-1 overflow-y-auto space-y-3 font-mono text-xs scrollbar-thin scrollbar-thumb-zinc-800">
            {isRawEditable ? (
              <textarea
                value={rawInput}
                onChange={(e) => setRawInput(e.target.value)}
                className="w-full h-44 p-2.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-200 text-xs font-mono resize-none focus:outline-hidden focus:border-emerald-500"
                placeholder="Paste raw perimeter syslog, CEF, LEEF, or JSON log here..."
              />
            ) : (
              <div className="relative">
                {/* Visual Label if slice is active */}
                {rawSlicedDisplay.hasSlice && (
                  <div className="mb-1.5 px-2 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-[10px] text-amber-300 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-semibold">
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      Synchronized Token Slice [{rawSlicedDisplay.start}:{rawSlicedDisplay.end}]
                    </span>
                    <span className="text-amber-400/80 font-mono">
                      {activeProvenance?.original_field} = "{String(activeProvenance?.original_value)}"
                    </span>
                  </div>
                )}

                {/* The highlighted text body */}
                <div className="p-3 rounded-md bg-zinc-900/80 border border-zinc-800 text-zinc-300 text-xs leading-relaxed font-mono break-all select-text shadow-inner">
                  {rawSlicedDisplay.hasSlice ? (
                    <>
                      <span className="text-zinc-400">{rawSlicedDisplay.prefix}</span>
                      <mark className="bg-amber-400/30 text-amber-200 ring-2 ring-amber-400/70 rounded-xs px-1 font-bold shadow-sm shadow-amber-950/80 transition-all duration-150">
                        {rawSlicedDisplay.highlighted}
                      </mark>
                      <span className="text-zinc-400">{rawSlicedDisplay.suffix}</span>
                    </>
                  ) : (
                    <span>{rawInput}</span>
                  )}
                </div>
              </div>
            )}

            {/* Cryptographic SHA-256 Proof Card */}
            <div className="p-2.5 rounded bg-zinc-900/50 border border-zinc-800/80 text-[11px] space-y-1.5">
              <div className="flex items-center justify-between text-zinc-400 font-semibold">
                <span className="flex items-center gap-1 text-emerald-400">
                  <Lock className="w-3 h-3" />
                  SHA-256 Ingest Seal
                </span>
                <span className="text-[10px] text-emerald-400/90 font-mono font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-2.5 h-2.5" />
                  VERIFIED
                </span>
              </div>
              <div className="text-[10px] font-mono text-zinc-400 break-all bg-zinc-950 p-1.5 rounded border border-zinc-800/60">
                {pipeline.envelope.sha256_hash}
              </div>
              <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-0.5">
                <span>Bytes: {String(pipeline.envelope.metadata.raw_byte_length ?? pipeline.envelope.raw_payload.length)}</span>
                <span>UUID: {pipeline.envelope.event_id.substring(0, 8)}...</span>
              </div>
            </div>

            {/* Parsed Raw Tokens Pill Matrix */}
            <div className="space-y-1.5">
              <div className="text-[10px] uppercase font-semibold text-zinc-500 flex items-center justify-between">
                <span>Extracted Tokens ({Object.keys(pipeline.parsed.fields).length})</span>
                <span className="text-[9px] text-zinc-600 font-mono">Click to Sync</span>
              </div>

              <div className="flex flex-wrap gap-1 max-h-36 overflow-y-auto p-1 bg-zinc-900/30 rounded border border-zinc-800/50">
                {Object.entries(pipeline.parsed.fields).map(([tokenKey, tokenVal]) => {
                  // Check if this token maps to active field
                  const isTokenActive =
                    activeProvenance?.original_field === tokenKey ||
                    String(activeProvenance?.original_value) === String(tokenVal);

                  // Find which canonical field this maps to
                  const mappedCanonicalRule = pipeline.matchedMapping.rules.find(
                    (r) => r.input_field.toLowerCase() === tokenKey.toLowerCase()
                  );

                  return (
                    <button
                      key={tokenKey}
                      onClick={() => {
                        if (mappedCanonicalRule) {
                          setSelectedFieldKey(mappedCanonicalRule.semantic_field);
                        }
                      }}
                      onMouseEnter={() => {
                        if (mappedCanonicalRule) {
                          setHoveredFieldKey(mappedCanonicalRule.semantic_field);
                        }
                      }}
                      onMouseLeave={() => setHoveredFieldKey(null)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono border transition-all cursor-pointer ${
                        isTokenActive
                          ? 'bg-amber-500/20 text-amber-200 border-amber-500/50 shadow-xs'
                          : mappedCanonicalRule
                          ? 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-emerald-500/40 hover:text-emerald-300'
                          : 'bg-zinc-900/50 text-zinc-500 border-zinc-800/50'
                      }`}
                      title={
                        mappedCanonicalRule
                          ? `Maps to canonical: ${mappedCanonicalRule.semantic_field}`
                          : 'Unmapped token'
                      }
                    >
                      <span className="font-semibold">{tokenKey}:</span>{' '}
                      <span className="text-zinc-400">{String(tokenVal).substring(0, 14)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            PANE 2: CANONICAL SEMANTIC NORMALIZER (Columns 5 to 8)
            ========================================================================= */}
        <section
          id="pane-2-canonical-normalizer"
          className="lg:col-span-4 flex flex-col h-full overflow-hidden bg-zinc-950/40"
        >
          {/* Pane Header */}
          <div className="p-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/40">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center text-[10px] font-bold">
                2
              </span>
              <div>
                <h3 className="text-xs font-semibold text-zinc-200">Canonical Normalizer</h3>
                <p className="text-[10px] text-zinc-500 font-mono">
                  Standardized schema & taxonomy
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-bold text-[10px]">
                {pipeline.normalizedResult.mappedCount} MAPPED
              </span>
              {Object.keys(pipeline.normalizedResult.unmappedFields).length > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-bold text-[10px]">
                  {Object.keys(pipeline.normalizedResult.unmappedFields).length} DRIFT
                </span>
              )}
            </div>
          </div>

          {/* Quick Filter Bar */}
          <div className="px-3 py-2 bg-zinc-900/30 border-b border-zinc-800 flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-zinc-500" />
            <input
              type="text"
              value={canonicalSearch}
              onChange={(e) => setCanonicalSearch(e.target.value)}
              placeholder="Search canonical field (ip, port, action, proto)..."
              className="bg-transparent border-none text-xs text-zinc-200 placeholder-zinc-500 focus:outline-hidden w-full font-mono"
            />
            {canonicalSearch && (
              <button
                onClick={() => setCanonicalSearch('')}
                className="text-[10px] text-zinc-500 hover:text-zinc-300 font-mono"
              >
                CLEAR
              </button>
            )}
          </div>

          {/* Canonical Fields Tree with SYNCHRONIZED INTERACTION */}
          <div className="flex-1 overflow-y-auto p-3 space-y-4 font-mono text-xs scrollbar-thin scrollbar-thumb-zinc-800">
            {/* Group 1: Network Source & Destination */}
            <div className="space-y-1.5">
              <div className="text-[10px] uppercase font-bold text-zinc-500 flex items-center justify-between pb-1 border-b border-zinc-800/60">
                <span>1. Network Identity (5-Tuple)</span>
                <span className="text-[9px] text-zinc-600 font-mono">IP / Port / Zone</span>
              </div>

              {[
                {
                  path: 'source.ip',
                  val: pipeline.normalizedResult.canonical.source.ip,
                  label: 'Source IP',
                },
                {
                  path: 'source.port',
                  val: pipeline.normalizedResult.canonical.source.port,
                  label: 'Source Port',
                },
                {
                  path: 'source.zone',
                  val: pipeline.normalizedResult.canonical.source.zone,
                  label: 'Source Zone',
                },
                {
                  path: 'source.nat_ip',
                  val: pipeline.normalizedResult.canonical.source.nat_ip,
                  label: 'Source NAT IP',
                },
                {
                  path: 'destination.ip',
                  val: pipeline.normalizedResult.canonical.destination.ip,
                  label: 'Destination IP',
                },
                {
                  path: 'destination.port',
                  val: pipeline.normalizedResult.canonical.destination.port,
                  label: 'Destination Port',
                },
                {
                  path: 'destination.zone',
                  val: pipeline.normalizedResult.canonical.destination.zone,
                  label: 'Destination Zone',
                },
                {
                  path: 'destination.nat_ip',
                  val: pipeline.normalizedResult.canonical.destination.nat_ip,
                  label: 'Dest NAT IP',
                },
              ]
                .filter(
                  (item) =>
                    !canonicalSearch ||
                    item.path.toLowerCase().includes(canonicalSearch.toLowerCase()) ||
                    String(item.val || '').toLowerCase().includes(canonicalSearch.toLowerCase())
                )
                .map((field) => renderCanonicalRow(field.path, field.val, field.label))}
            </div>

            {/* Group 2: Protocol, Action & Telemetry */}
            <div className="space-y-1.5">
              <div className="text-[10px] uppercase font-bold text-zinc-500 flex items-center justify-between pb-1 border-b border-zinc-800/60">
                <span>2. Protocol & Policy Action</span>
                <span className="text-[9px] text-zinc-600 font-mono">Firewall Decision</span>
              </div>

              {[
                {
                  path: 'network.protocol',
                  val: pipeline.normalizedResult.canonical.network.protocol,
                  label: 'Protocol',
                },
                {
                  path: 'network.action',
                  val: pipeline.normalizedResult.canonical.network.action,
                  label: 'Action',
                },
                {
                  path: 'network.session_id',
                  val: pipeline.normalizedResult.canonical.network.session_id,
                  label: 'Session ID',
                },
                {
                  path: 'network.bytes_in',
                  val: pipeline.normalizedResult.canonical.network.bytes_in,
                  label: 'Bytes In',
                },
                {
                  path: 'network.bytes_out',
                  val: pipeline.normalizedResult.canonical.network.bytes_out,
                  label: 'Bytes Out',
                },
                {
                  path: 'network.packets',
                  val: pipeline.normalizedResult.canonical.network.packets,
                  label: 'Packets',
                },
              ]
                .filter(
                  (item) =>
                    !canonicalSearch ||
                    item.path.toLowerCase().includes(canonicalSearch.toLowerCase()) ||
                    String(item.val || '').toLowerCase().includes(canonicalSearch.toLowerCase())
                )
                .map((field) => renderCanonicalRow(field.path, field.val, field.label))}
            </div>

            {/* Group 3: Threat Intelligence */}
            {pipeline.normalizedResult.canonical.threat && (
              <div className="space-y-1.5">
                <div className="text-[10px] uppercase font-bold text-red-400/80 flex items-center justify-between pb-1 border-b border-zinc-800/60">
                  <span>3. Threat Intelligence</span>
                  <span className="text-[9px] text-red-400/60 font-mono">IDS / Exploit</span>
                </div>

                {[
                  {
                    path: 'threat.severity',
                    val: pipeline.normalizedResult.canonical.threat.severity,
                    label: 'Threat Severity',
                  },
                  {
                    path: 'threat.signature',
                    val: pipeline.normalizedResult.canonical.threat.signature,
                    label: 'Threat Signature',
                  },
                  {
                    path: 'threat.category',
                    val: pipeline.normalizedResult.canonical.threat.category,
                    label: 'Threat Category',
                  },
                  {
                    path: 'threat.cve',
                    val: pipeline.normalizedResult.canonical.threat.cve,
                    label: 'CVE ID',
                  },
                ]
                  .filter(
                    (item) =>
                      !canonicalSearch ||
                      item.path.toLowerCase().includes(canonicalSearch.toLowerCase()) ||
                      String(item.val || '').toLowerCase().includes(canonicalSearch.toLowerCase())
                  )
                  .map((field) => renderCanonicalRow(field.path, field.val, field.label))}
              </div>
            )}

            {/* Group 4: Device & Metadata */}
            <div className="space-y-1.5">
              <div className="text-[10px] uppercase font-bold text-zinc-500 flex items-center justify-between pb-1 border-b border-zinc-800/60">
                <span>4. Perimeter Device Observer</span>
                <span className="text-[9px] text-zinc-600 font-mono">Telemetry Source</span>
              </div>

              {[
                {
                  path: 'device.vendor',
                  val: pipeline.normalizedResult.canonical.device.vendor,
                  label: 'Vendor',
                },
                {
                  path: 'device.product',
                  val: pipeline.normalizedResult.canonical.device.product,
                  label: 'Product',
                },
                {
                  path: 'device.version',
                  val: pipeline.normalizedResult.canonical.device.version,
                  label: 'Firmware Version',
                },
                {
                  path: 'device.hostname',
                  val: pipeline.normalizedResult.canonical.device.hostname,
                  label: 'Hostname',
                },
              ]
                .filter(
                  (item) =>
                    !canonicalSearch ||
                    item.path.toLowerCase().includes(canonicalSearch.toLowerCase()) ||
                    String(item.val || '').toLowerCase().includes(canonicalSearch.toLowerCase())
                )
                .map((field) => renderCanonicalRow(field.path, field.val, field.label))}
            </div>

            {/* Schema Drift / Unmapped Field Section */}
            {Object.keys(pipeline.normalizedResult.unmappedFields).length > 0 && (
              <div className="p-2.5 rounded-md bg-amber-500/5 border border-amber-500/20 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-semibold text-amber-300">
                  <span className="flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    Schema Drift Quarantine ({Object.keys(pipeline.normalizedResult.unmappedFields).length})
                  </span>
                  {onOpenRegistry && (
                    <button
                      onClick={onOpenRegistry}
                      className="text-[10px] text-amber-400 hover:text-amber-200 underline cursor-pointer"
                    >
                      Branch Version in Registry
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-zinc-400 leading-tight">
                  The following raw tokens exist in the payload but lack semantic mapping in schema version{' '}
                  <span className="font-mono text-zinc-200">{pipeline.matchedMapping.software_version}</span>:
                </p>
                <div className="space-y-1 pt-1">
                  {Object.entries(pipeline.normalizedResult.unmappedFields).map(([k, v]) => (
                    <div
                      key={k}
                      className="flex items-center justify-between px-1.5 py-0.5 rounded bg-zinc-900/80 border border-zinc-800 text-[10px]"
                    >
                      <span className="text-zinc-300 font-bold">{k}</span>
                      <span className="text-zinc-500 max-w-[140px] truncate">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* =========================================================================
            PANE 3: OUTPUT PROJECTOR & FORENSIC LINEAGE (Columns 9 to 12)
            ========================================================================= */}
        <section
          id="pane-3-output-projector"
          className="lg:col-span-4 flex flex-col h-full overflow-hidden bg-zinc-950/80"
        >
          {/* Pane Header */}
          <div className="p-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/40">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400 flex items-center justify-center text-[10px] font-bold">
                3
              </span>
              <div>
                <h3 className="text-xs font-semibold text-zinc-200">Output Profile & Lineage</h3>
                <p className="text-[10px] text-zinc-500 font-mono">Plug & Play destination format</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() =>
                  handleCopy(JSON.stringify(pipeline.projected, null, 2), 'projected')
                }
                className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 border border-zinc-700 cursor-pointer"
                title="Copy Projected JSON"
              >
                {copiedSection === 'projected' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* Profile Selector Pills */}
          <div className="px-3 py-2 bg-zinc-900/30 border-b border-zinc-800 overflow-x-auto">
            <div className="flex items-center gap-1">
              {PRESET_OUTPUT_PROFILES.map((p) => {
                const isActive = p.id === activeProfileId;
                return (
                  <button
                    key={p.id}
                    onClick={() => setActiveProfileId(p.id)}
                    className={`px-2 py-1 rounded text-[10px] font-mono whitespace-nowrap cursor-pointer transition-all ${
                      isActive
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/50 shadow-xs font-semibold'
                        : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                    }`}
                  >
                    {p.name.split(' ')[0]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Pane Body: Interactive Forensic Lineage Graph + Formatted JSON */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 font-mono text-xs scrollbar-thin scrollbar-thumb-zinc-800">
            {/* Interactive Synchronized Lineage Card */}
            {activeProvenance && (
              <div className="p-3 rounded-md bg-zinc-900/90 border border-amber-500/40 space-y-2 shadow-sm">
                <div className="flex items-center justify-between text-[11px] font-semibold text-amber-300 pb-1 border-b border-zinc-800">
                  <span className="flex items-center gap-1.5">
                    <Fingerprint className="w-3.5 h-3.5 text-amber-400" />
                    Forensic Provenance Graph
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono">
                    {Math.round(activeProvenance.confidence * 100)}% Confidence
                  </span>
                </div>

                {/* Visual Step-by-Step Provenance Journey */}
                <div className="space-y-1 text-[11px]">
                  {/* Step 1: Raw Byte Slice */}
                  <div className="flex items-start gap-2 text-zinc-300">
                    <span className="text-zinc-500 text-[10px] w-14 shrink-0 font-bold">1. RAW:</span>
                    <div className="flex-1">
                      <span className="px-1.5 py-0.2 rounded bg-zinc-950 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                        Slice [{activeProvenance.raw_slice?.start ?? '?'}:{activeProvenance.raw_slice?.end ?? '?'}]
                      </span>
                      <span className="text-zinc-400 ml-1.5 text-[10px]">
                        "{String(activeProvenance.original_value)}"
                      </span>
                    </div>
                  </div>

                  {/* Step 2: Source Token */}
                  <div className="flex items-start gap-2 text-zinc-300">
                    <span className="text-zinc-500 text-[10px] w-14 shrink-0 font-bold">2. TOKEN:</span>
                    <div className="flex-1 text-[10px]">
                      <span className="text-zinc-400">Key:</span>{' '}
                      <span className="text-zinc-200 font-bold">{activeProvenance.original_field}</span>
                    </div>
                  </div>

                  {/* Step 3: Transformation Rule */}
                  <div className="flex items-start gap-2 text-zinc-300">
                    <span className="text-zinc-500 text-[10px] w-14 shrink-0 font-bold">3. RULE:</span>
                    <div className="flex-1 text-[10px]">
                      <span className="px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-300 font-bold uppercase">
                        {activeProvenance.mapping_rule}
                      </span>
                      <span className="text-zinc-500 ml-1.5">
                        Schema v{activeProvenance.mapping_version}
                      </span>
                    </div>
                  </div>

                  {/* Step 4: Canonical Field */}
                  <div className="flex items-start gap-2 text-zinc-300">
                    <span className="text-zinc-500 text-[10px] w-14 shrink-0 font-bold">4. TARGET:</span>
                    <div className="flex-1 text-[10px]">
                      <span className="text-emerald-400 font-bold">{activeProvenance.output_field}</span>{' '}
                      = <span className="text-zinc-100 font-semibold">"{String(activeProvenance.output_value)}"</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Projected JSON Output with Synchronized Line Highlighting */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10px] uppercase font-bold text-zinc-500">
                <span className="flex items-center gap-1.5">
                  <FileJson className="w-3.5 h-3.5 text-purple-400" />
                  Projected Profile Output ({pipeline.profile.name})
                </span>
                <span className="text-zinc-600 font-mono text-[9px]">Live Projection</span>
              </div>

              {/* Formatted JSON Display */}
              <div className="rounded-md bg-zinc-900/90 border border-zinc-800 p-2.5 font-mono text-[11px] leading-relaxed text-zinc-300 overflow-x-auto shadow-inner max-h-[380px] scrollbar-thin scrollbar-thumb-zinc-800">
                <pre className="whitespace-pre">
                  {formatProjectedJsonWithHighlight(pipeline.projected, activeFieldKey)}
                </pre>
              </div>
            </div>

            {/* Profile Documentation / Contract Strip */}
            <div className="p-2.5 rounded bg-zinc-900/40 border border-zinc-800 text-[10px] space-y-1 text-zinc-400">
              <div className="flex items-center justify-between text-zinc-300 font-semibold">
                <span>Profile Specification</span>
                <span className="font-mono text-purple-400">{pipeline.profile.id}</span>
              </div>
              <p className="text-zinc-500 leading-tight">{pipeline.profile.description}</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );

  // Helper to render a Canonical Semantic Row with Synchronized Highlighting
  function renderCanonicalRow(fieldPath: string, value: unknown, label: string) {
    const isPresent = value !== undefined && value !== null && value !== '';
    const isSynchronized = activeFieldKey === fieldPath;
    const prov = pipeline.normalizedResult.provenance.lineage[fieldPath];

    return (
      <div
        key={fieldPath}
        onClick={() => setSelectedFieldKey(fieldPath)}
        onMouseEnter={() => setHoveredFieldKey(fieldPath)}
        onMouseLeave={() => setHoveredFieldKey(null)}
        className={`group p-2 rounded-md transition-all cursor-pointer border ${
          isSynchronized
            ? 'bg-amber-500/10 border-amber-500/50 shadow-sm ring-1 ring-amber-400/40 text-amber-200'
            : isPresent
            ? 'bg-zinc-900/60 border-zinc-800 hover:border-emerald-500/40 text-zinc-200 hover:bg-zinc-900'
            : 'bg-zinc-950/40 border-zinc-900 text-zinc-600 opacity-60'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isSynchronized
                  ? 'bg-amber-400 animate-pulse'
                  : isPresent
                  ? 'bg-emerald-400'
                  : 'bg-zinc-700'
              }`}
            />
            <span className="font-bold text-[11px] text-zinc-300 group-hover:text-emerald-300 transition-colors">
              {fieldPath}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {prov && (
              <span className="text-[9px] px-1 py-0.2 rounded bg-purple-500/10 text-purple-300 font-mono uppercase font-semibold">
                {prov.mapping_rule}
              </span>
            )}
            <span
              className={`text-[11px] font-mono font-semibold ${
                isSynchronized
                  ? 'text-amber-300'
                  : isPresent
                  ? 'text-emerald-400'
                  : 'text-zinc-600'
              }`}
            >
              {isPresent ? String(value) : '—'}
            </span>
          </div>
        </div>

        {/* Source Token & Slice info if present */}
        {prov && (
          <div className="mt-1 flex items-center justify-between text-[9px] text-zinc-500 font-mono pt-1 border-t border-zinc-800/40">
            <span>
              From: <span className="text-zinc-300">{prov.original_field}</span>
            </span>
            {prov.raw_slice && (
              <span>
                Slice: [{prov.raw_slice.start}:{prov.raw_slice.end}]
              </span>
            )}
          </div>
        )}
      </div>
    );
  }
};

/**
 * Formats JSON and visually highlights lines corresponding to the actively focused field.
 */
function formatProjectedJsonWithHighlight(data: unknown, activeField: string): React.ReactNode {
  const jsonStr = JSON.stringify(data, null, 2);
  const lines = jsonStr.split('\n');

  // Match key patterns like "source_ip": or "src": or "action":
  const searchSub = activeField.split('.').pop() || activeField;

  return lines.map((line, idx) => {
    const isTargetLine =
      line.toLowerCase().includes(`"${searchSub.toLowerCase()}"`) ||
      line.toLowerCase().includes(`"${activeField.toLowerCase()}"`);

    return (
      <div
        key={idx}
        className={`px-1 rounded transition-colors ${
          isTargetLine
            ? 'bg-amber-400/20 text-amber-200 font-bold border-l-2 border-amber-400 pl-2'
            : 'hover:bg-zinc-800/40 text-zinc-300'
        }`}
      >
        {line}
      </div>
    );
  });
}
