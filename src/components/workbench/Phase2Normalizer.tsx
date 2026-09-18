/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Layers,
  ArrowRight,
  Shield,
  FileCheck2,
  Copy,
  Check,
  Download,
  Terminal,
  ExternalLink,
  Cpu,
  Fingerprint,
  Info,
  Sliders,
  ChevronRight,
  HelpCircle,
} from 'lucide-react';
import { GOLDEN_CORPUS, GoldenSample } from '../../data/goldenCorpus.ts';
import { createCommonEventEnvelope } from '../../core/envelope.ts';
import { detectLogFormatAndVendor, parseAnyLog } from '../../core/detector.ts';
import { knowledgeRegistry } from '../../services/knowledgeRegistry.ts';
import { normalizeEvent } from '../../core/normalizer.ts';
import { PRESET_OUTPUT_PROFILES, projectEvent } from '../../services/outputProfiles.ts';
import { KnowledgeRegistryExplorer } from '../knowledge/KnowledgeRegistryExplorer.tsx';
import { OutputProfile, VersionedMapping } from '../../types.ts';

interface Phase2NormalizerProps {
  onEventProcessed?: (latencyMs: number) => void;
}

export const Phase2Normalizer: React.FC<Phase2NormalizerProps> = ({ onEventProcessed }) => {
  const [selectedSampleId, setSelectedSampleId] = useState<string>(
    GOLDEN_CORPUS[0].id
  );
  const [rawInput, setRawInput] = useState<string>(GOLDEN_CORPUS[0].raw);
  const [activeProfileId, setActiveProfileId] = useState<string>('soc_investigation');
  const [selectedMappingOverride, setSelectedMappingOverride] = useState<VersionedMapping | null>(
    null
  );
  const [selectedLineageField, setSelectedLineageField] = useState<string>('network.action');
  const [copiedJson, setCopiedJson] = useState(false);
  const [isRegistryOpen, setIsRegistryOpen] = useState(false);

  const lastReportedHashRef = useRef<string>('');

  // Selected output profile
  const activeProfile: OutputProfile = useMemo(() => {
    return (
      PRESET_OUTPUT_PROFILES.find((p) => p.id === activeProfileId) ||
      PRESET_OUTPUT_PROFILES[0]
    );
  }, [activeProfileId]);

  // Real-time Pipeline Execution (Phase 1 -> Phase 2 Normalization -> Output Projection)
  const processingPipeline = useMemo(() => {
    const startTime = performance.now();

    // 1. Detection
    const detection = detectLogFormatAndVendor(rawInput);

    // 2. Envelope & SHA-256
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

    // 5. Canonical Normalization & Provenance
    const normalization = normalizeEvent(envelope, parsed, matchedMapping);

    // 6. Output Projection
    const projectedOutput = projectEvent(normalization.canonical, activeProfile, {
      sha256_hash: envelope.sha256_hash,
    });

    const endTime = performance.now();
    const totalLatency = Math.max(0.08, endTime - startTime);

    return {
      envelope,
      detection,
      parsed,
      matchedMapping,
      normalization,
      projectedOutput,
      totalLatency,
    };
  }, [rawInput, selectedMappingOverride, activeProfile]);

  // Safe post-render telemetry update
  useEffect(() => {
    if (processingPipeline.envelope.sha256_hash !== lastReportedHashRef.current) {
      lastReportedHashRef.current = processingPipeline.envelope.sha256_hash;
      if (onEventProcessed) {
        onEventProcessed(processingPipeline.totalLatency);
      }
    }
  }, [
    processingPipeline.envelope.sha256_hash,
    processingPipeline.totalLatency,
    onEventProcessed,
  ]);

  const handleSelectSample = (sample: GoldenSample) => {
    setSelectedSampleId(sample.id);
    setRawInput(sample.raw);
    setSelectedMappingOverride(null);
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(
      JSON.stringify(processingPipeline.projectedOutput, null, 2)
    );
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 1800);
  };

  const handleDownloadJson = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(processingPipeline.projectedOutput, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute(
      'download',
      `normalized-${processingPipeline.envelope.event_id.slice(0, 8)}.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const activeLineageRecord =
    processingPipeline.normalization.provenance.lineage[selectedLineageField] ||
    Object.values(processingPipeline.normalization.provenance.lineage)[0];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-zinc-900 font-sans select-none">
      {/* Top Header & Context Bar */}
      <div className="px-5 py-3 border-b border-zinc-800/90 bg-zinc-950 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold tracking-wide text-zinc-100 flex items-center gap-2">
              <span>Phase 2: Deterministic Semantic Engine & Knowledge Registry</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                CANONICAL ENGINE
              </span>
            </h2>
          </div>
          <p className="text-[11px] text-zinc-400">
            Transforms raw extracted perimeter tokens into canonical concepts using versioned mapping rules and cryptographic lineage.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsRegistryOpen(true)}
            className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-200 text-xs font-medium flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            <span>Knowledge Registry</span>
            <span className="text-[10px] font-mono px-1 rounded bg-zinc-800 text-zinc-400">
              {knowledgeRegistry.getAllMappings().length} rules
            </span>
          </button>
        </div>
      </div>

      {/* Sample Selector Ribbon */}
      <div className="px-5 py-2 border-b border-zinc-800/80 bg-zinc-950/60 flex items-center justify-between gap-3 text-xs overflow-x-auto shrink-0">
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">
            Perimeter Fleet:
          </span>
          <div className="flex items-center gap-1.5">
            {GOLDEN_CORPUS.map((sample: GoldenSample) => {
              const isSelected = selectedSampleId === sample.id;
              return (
                <button
                  key={sample.id}
                  onClick={() => handleSelectSample(sample)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                    isSelected
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs'
                      : 'bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border border-zinc-800'
                  }`}
                >
                  {sample.name.split(' ')[0]} {sample.name.split(' ')[1] || ''}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 text-[11px] text-zinc-400">
          <span className="flex items-center gap-1 font-mono">
            <Cpu className="w-3 h-3 text-emerald-400" />
            {processingPipeline.totalLatency.toFixed(2)} ms
          </span>
          <span className="text-zinc-600">|</span>
          <span className="font-mono text-zinc-300">
            {processingPipeline.normalization.mappedCount} Mapped Fields
          </span>
        </div>
      </div>

      {/* Main 3-Pane Responsive Workbench */}
      <div className="flex-1 grid grid-cols-12 gap-0 overflow-hidden">
        {/* PANE 1: Raw Input & Ingestion Proof (3.5 cols) */}
        <div className="col-span-3 border-r border-zinc-800/80 flex flex-col bg-zinc-950/40 overflow-hidden">
          {/* Pane Header */}
          <div className="px-4 py-2.5 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-zinc-400" />
              1. Untouched Payload
            </span>
            <div className="flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
              <Fingerprint className="w-3 h-3" />
              100% LOSSLESS
            </div>
          </div>

          {/* Raw Text Box */}
          <div className="p-3 flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between text-[10px] text-zinc-500 mb-1.5 font-mono">
              <span>{rawInput.length} chars • {new Blob([rawInput]).size} bytes</span>
              <span className="text-emerald-400/90 font-medium uppercase">
                {processingPipeline.detection.format}
              </span>
            </div>

            <textarea
              value={rawInput}
              onChange={(e) => {
                setRawInput(e.target.value);
                setSelectedSampleId('custom');
              }}
              rows={8}
              className="w-full p-2.5 rounded-lg bg-zinc-950 border border-zinc-800/90 text-zinc-300 font-mono text-[11px] leading-relaxed resize-none focus:outline-hidden focus:border-emerald-500/50"
              placeholder="Paste raw perimeter firewall, IDS, or gateway log payload..."
            />

            {/* Cryptographic SHA-256 Badge */}
            <div className="mt-3 p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 font-mono text-[10px]">
              <div className="text-zinc-500 text-[9px] uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>Tamper-Proof SHA-256 Digest</span>
                <span className="text-emerald-400">VERIFIED</span>
              </div>
              <div className="text-emerald-300 font-semibold break-all selection:bg-emerald-500/30">
                {processingPipeline.envelope.sha256_hash}
              </div>
            </div>

            {/* Ingestion Source Info */}
            <div className="mt-3 p-2.5 rounded-lg bg-zinc-900/50 border border-zinc-800/80 text-[11px] space-y-1.5">
              <div className="text-zinc-400 text-[10px] font-semibold uppercase tracking-wider">
                Ingestion Origin
              </div>
              <div className="flex items-center justify-between text-zinc-300 font-mono text-[10px]">
                <span className="text-zinc-500">Device ID:</span>
                <span>{processingPipeline.envelope.ingestion_source.device_id}</span>
              </div>
              <div className="flex items-center justify-between text-zinc-300 font-mono text-[10px]">
                <span className="text-zinc-500">Source IP:</span>
                <span>{processingPipeline.envelope.ingestion_source.ip_address}</span>
              </div>
              <div className="flex items-center justify-between text-zinc-300 font-mono text-[10px]">
                <span className="text-zinc-500">Detected Vendor:</span>
                <span className="text-emerald-400 font-medium">
                  {processingPipeline.detection.vendor} ({Math.round(processingPipeline.detection.vendor_confidence * 100)}%)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* PANE 2: Canonical Semantic Normalization (5 cols) */}
        <div className="col-span-5 border-r border-zinc-800/80 flex flex-col bg-zinc-900 overflow-hidden">
          {/* Pane Header */}
          <div className="px-4 py-2.5 border-b border-zinc-800 bg-zinc-900/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs font-semibold text-zinc-200">
                2. Canonical Semantic Normalizer
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-mono">
              <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                Rule: {processingPipeline.matchedMapping.software_version}
              </span>
            </div>
          </div>

          {/* Matched Knowledge Rule Summary */}
          <div className="px-4 py-2.5 bg-zinc-950/60 border-b border-zinc-800/60 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 truncate">
              <span className="text-zinc-400">Matched Product:</span>
              <span className="font-semibold text-zinc-100 truncate">
                {processingPipeline.matchedMapping.product}
              </span>
            </div>
            <button
              onClick={() => setIsRegistryOpen(true)}
              className="text-[11px] text-emerald-400 hover:text-emerald-300 font-medium shrink-0"
            >
              Inspect Rules →
            </button>
          </div>

          {/* Canonical Fields Table */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            <div className="rounded-lg border border-zinc-800 overflow-hidden bg-zinc-950 shadow-xs">
              <div className="px-3 py-2 bg-zinc-900/60 border-b border-zinc-800 text-[11px] font-medium text-zinc-400 flex items-center justify-between">
                <span>Canonical Normalization Mapping</span>
                <span className="text-[10px] font-mono text-zinc-500">
                  {Object.keys(processingPipeline.normalization.provenance.lineage).length} Mapped
                </span>
              </div>

              <div className="divide-y divide-zinc-800/60 font-mono text-xs">
                {Object.entries(processingPipeline.normalization.provenance.lineage).map(
                  ([fieldKey, record]) => {
                    const isSelected = selectedLineageField === fieldKey;
                    const val = record.output_value;

                    return (
                      <div
                        key={fieldKey}
                        onClick={() => setSelectedLineageField(fieldKey)}
                        className={`p-2.5 flex items-center justify-between cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-emerald-500/10 border-l-2 border-emerald-400'
                            : 'hover:bg-zinc-900/50'
                        }`}
                      >
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-zinc-200 text-[11px]">
                              {fieldKey}
                            </span>
                            <span className="text-[9px] uppercase font-sans px-1 rounded bg-zinc-800 text-zinc-400">
                              {record.mapping_rule}
                            </span>
                          </div>
                          <div className="text-[10px] text-zinc-500 truncate font-sans">
                            source: <span className="font-mono text-zinc-400">{record.original_field}</span>
                          </div>
                        </div>

                        {/* Normalized Value Pill */}
                        <div className="text-right shrink-0">
                          {fieldKey === 'network.action' ? (
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                val === 'ALLOWED'
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : val === 'BLOCKED'
                                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              }`}
                            >
                              {String(val)}
                            </span>
                          ) : fieldKey === 'network.protocol' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                              {String(val)}
                            </span>
                          ) : fieldKey === 'threat.severity' ? (
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                val === 'CRITICAL'
                                  ? 'bg-rose-500/20 text-rose-400'
                                  : val === 'HIGH'
                                  ? 'bg-orange-500/20 text-orange-400'
                                  : 'bg-zinc-800 text-zinc-300'
                              }`}
                            >
                              {String(val)}
                            </span>
                          ) : (
                            <span className="text-zinc-200 text-[11px] font-semibold">
                              {String(val)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            </div>

            {/* Unmapped Raw Attributes (Drift Warning Preview) */}
            {Object.keys(processingPipeline.normalization.unmappedFields).length > 0 && (
              <div className="p-3 rounded-lg bg-zinc-950/80 border border-amber-500/30 text-xs">
                <div className="flex items-center gap-1.5 text-amber-400 font-semibold mb-1.5 text-[11px]">
                  <Info className="w-3.5 h-3.5" />
                  <span>Unmapped Raw Attributes ({Object.keys(processingPipeline.normalization.unmappedFields).length})</span>
                </div>
                <p className="text-[10px] text-zinc-400 mb-2">
                  These parsed fields have no mapping rules in version {processingPipeline.matchedMapping.software_version}.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(processingPipeline.normalization.unmappedFields).map(([k, v]) => (
                    <span
                      key={k}
                      className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] font-mono text-zinc-400"
                    >
                      <span className="text-zinc-500">{k}:</span> {String(v)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* PANE 3: Output Profile Projector & Lineage (4 cols) */}
        <div className="col-span-4 flex flex-col bg-zinc-950 overflow-hidden">
          {/* Pane Header & Profile Selector */}
          <div className="px-4 py-2.5 border-b border-zinc-800 bg-zinc-900/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileCheck2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs font-semibold text-zinc-200">
                3. Output Profile Projector
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleCopyJson}
                className="p-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
                title="Copy JSON"
              >
                {copiedJson ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={handleDownloadJson}
                className="p-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
                title="Download JSON"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Profile Switcher Pills */}
          <div className="px-3 py-2 border-b border-zinc-800 bg-zinc-900/30 flex items-center gap-1.5 overflow-x-auto text-[11px]">
            {PRESET_OUTPUT_PROFILES.map((profile) => {
              const isActive = activeProfileId === profile.id;
              return (
                <button
                  key={profile.id}
                  onClick={() => setActiveProfileId(profile.id)}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-medium whitespace-nowrap transition-colors ${
                    isActive
                      ? 'bg-zinc-800 text-zinc-100 border border-zinc-700 font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                  }`}
                >
                  {profile.name.split(' ')[0]} {profile.name.split(' ')[1] || ''}
                </button>
              );
            })}
          </div>

          {/* Projected JSON Display */}
          <div className="flex-1 overflow-y-auto p-3 flex flex-col font-mono text-[11px]">
            <pre className="flex-1 p-3 rounded-lg bg-zinc-900/90 border border-zinc-800/80 text-emerald-400 leading-relaxed overflow-x-auto selection:bg-emerald-500/20">
              {JSON.stringify(processingPipeline.projectedOutput, null, 2)}
            </pre>

            {/* Cryptographic Forensic Lineage Card */}
            {activeLineageRecord && (
              <div className="mt-3 p-3 rounded-lg bg-zinc-900 border border-emerald-500/30 text-xs">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-800">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-emerald-400 flex items-center gap-1.5 font-sans">
                    <Fingerprint className="w-3 h-3" />
                    Forensic Field Lineage
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400">
                    Confidence: {Math.round(activeLineageRecord.confidence * 100)}%
                  </span>
                </div>

                <div className="space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500">Canonical Target:</span>
                    <span className="text-zinc-200 font-semibold">
                      {activeLineageRecord.output_field} = {String(activeLineageRecord.output_value)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500">Raw Input Field:</span>
                    <span className="text-zinc-300">
                      {activeLineageRecord.original_field} = &quot;{String(activeLineageRecord.original_value)}&quot;
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500">Transformation:</span>
                    <span className="text-purple-400 uppercase text-[10px] font-mono">
                      {activeLineageRecord.mapping_rule} (Version: {activeLineageRecord.mapping_version})
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500">Envelope Proof:</span>
                    <span className="text-zinc-400 font-mono text-[9px] truncate max-w-[160px]">
                      {processingPipeline.normalization.provenance.sha256_hash.slice(0, 16)}...
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Versioned Knowledge Registry Modal */}
      <KnowledgeRegistryExplorer
        isOpen={isRegistryOpen}
        onClose={() => setIsRegistryOpen(false)}
        onSelectMapping={(mapping) => {
          setSelectedMappingOverride(mapping);
        }}
      />
    </div>
  );
};
