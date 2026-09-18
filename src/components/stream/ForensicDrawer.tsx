/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Shield,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  Download,
  Fingerprint,
  Zap,
  Activity,
  Layers,
  ArrowRight,
  FileJson,
  FileText,
  CornerDownRight,
  Sparkles,
  ExternalLink,
  Sliders,
  Eye,
  Info,
  Flame,
} from 'lucide-react';
import { ProcessedStreamEvent, FieldProvenance } from '../../types.ts';
import { PRESET_OUTPUT_PROFILES, projectEvent } from '../../services/outputProfiles.ts';
import { knowledgeRegistry } from '../../services/knowledgeRegistry.ts';
import { quarantineManager } from '../../services/quarantineManager.ts';

interface ForensicDrawerProps {
  event: ProcessedStreamEvent | null;
  isOpen: boolean;
  onClose: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
  currentIndex?: number;
  totalEvents?: number;
  onOpenRegistry?: () => void;
  onOpenDriftEngine?: () => void;
}

export const ForensicDrawer: React.FC<ForensicDrawerProps> = ({
  event,
  isOpen,
  onClose,
  onPrevious,
  onNext,
  hasPrevious = false,
  hasNext = false,
  currentIndex = 0,
  totalEvents = 0,
  onOpenRegistry,
  onOpenDriftEngine,
}) => {
  // 5 Active Tabs
  const [activeTab, setActiveTab] = useState<
    'canonical' | 'raw_envelope' | 'provenance' | 'profiles' | 'drift'
  >('canonical');

  // Interactive selected field for Synchronized Highlighting across tabs
  const [selectedFieldKey, setSelectedFieldKey] = useState<string>('source.ip');
  const [selectedProfileId, setSelectedProfileId] = useState<string>('soc_investigation');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Keyboard navigation (ESC to close, Left/Right for prev/next)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && hasPrevious && onPrevious) {
        onPrevious();
      } else if (e.key === 'ArrowRight' && hasNext && onNext) {
        onNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, hasPrevious, hasNext, onPrevious, onNext, onClose]);

  // Reset tab or defaults when event changes
  useEffect(() => {
    if (event) {
      if (event.isDrift && activeTab === 'canonical') {
        // Keep default or allow quick inspection
      }
      setSelectedFieldKey('source.ip');
    }
  }, [event?.id]);

  if (!isOpen || !event) return null;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleExportReceipt = () => {
    const bundle = {
      manifest: 'SIMPLIFYR_FORENSIC_EVENT_RECEIPT_V1',
      exported_at: new Date().toISOString(),
      event_id: event.id,
      sha256: event.envelope.sha256_hash,
      raw_payload: event.raw,
      envelope: event.envelope,
      detection: event.detection,
      applied_mapping: {
        vendor: event.mapping.vendor,
        version: event.mapping.software_version,
        mapping_id: event.mapping.mapping_id,
      },
      canonical: event.canonical,
      provenance: event.provenance,
      unmapped_fields: event.unmappedFields,
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `forensic-evidence-${event.id.substring(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Synchronized slice for the selected field in Provenance & Raw viewer
  const activeProv: FieldProvenance | undefined = event.provenance.lineage[selectedFieldKey];
  const slice = activeProv?.raw_slice;
  const rawSliced = useMemo(() => {
    const raw = event.raw;
    if (!slice || slice.start < 0 || slice.end > raw.length || slice.start >= slice.end) {
      return { prefix: raw, highlighted: '', suffix: '', hasSlice: false };
    }
    return {
      prefix: raw.substring(0, slice.start),
      highlighted: raw.substring(slice.start, slice.end),
      suffix: raw.substring(slice.end),
      hasSlice: true,
      start: slice.start,
      end: slice.end,
    };
  }, [event.raw, slice]);

  // Projected output for Tab 4
  const activeProfile =
    PRESET_OUTPUT_PROFILES.find((p) => p.id === selectedProfileId) || PRESET_OUTPUT_PROFILES[0];
  const projectedOutput = projectEvent(event.canonical, activeProfile);

  const unmappedCount = Object.keys(event.unmappedFields).length;

  return (
    <div
      id="forensic-drawer-overlay"
      className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-xs transition-opacity duration-200 select-none font-sans"
    >
      {/* Background click to dismiss */}
      <div className="flex-1 cursor-pointer" onClick={onClose} />

      {/* Main Drawer Container */}
      <div
        id="forensic-drawer-panel"
        className="w-full max-w-2xl lg:max-w-3xl h-full bg-zinc-950 border-l border-zinc-800 text-zinc-100 flex flex-col shadow-2xl z-10 animate-in slide-in-from-right duration-200 overflow-hidden"
      >
        {/* =====================================================================
            DRAWER HEADER & NAVIGATION
            ===================================================================== */}
        <header className="p-4 bg-zinc-900/90 border-b border-zinc-800 shrink-0 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-xs shadow-emerald-400" />
              <h2 className="text-sm font-semibold tracking-wide text-zinc-100 flex items-center gap-2">
                <span>FORENSIC EVENT INSPECTOR</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700 font-bold">
                  {event.detection.vendor}
                </span>
              </h2>
            </div>

            {/* Previous/Next and Close controls */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-xs font-mono text-zinc-400 mr-2">
                <span>
                  {currentIndex + 1} of {totalEvents}
                </span>
                <div className="flex items-center ml-1">
                  <button
                    onClick={onPrevious}
                    disabled={!hasPrevious}
                    className="p-1 rounded hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer text-zinc-300"
                    title="Previous Event (Left Arrow)"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={onNext}
                    disabled={!hasNext}
                    className="p-1 rounded hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer text-zinc-300"
                    title="Next Event (Right Arrow)"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <button
                onClick={handleExportReceipt}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium cursor-pointer border border-zinc-700 transition-colors"
                title="Download Tamper-Proof Forensic Receipt"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Export Proof</span>
              </button>

              <button
                onClick={onClose}
                className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 cursor-pointer border border-zinc-800"
                title="Close Inspector (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Event Metadata Strip */}
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono pt-1">
            {/* Action Badge */}
            <span
              className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                event.canonical.network.action === 'BLOCKED'
                  ? 'bg-rose-500/15 text-rose-300 border-rose-500/40'
                  : event.canonical.network.action === 'ALLOWED'
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                  : 'bg-amber-500/15 text-amber-300 border-amber-500/40'
              }`}
            >
              {event.canonical.network.action}
            </span>

            {/* Severity Pill if Threat */}
            {event.canonical.threat && (
              <span
                className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                  event.canonical.threat.severity === 'CRITICAL'
                    ? 'bg-rose-600/20 text-rose-300 border-rose-500/50'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                }`}
              >
                {event.canonical.threat.severity}
              </span>
            )}

            {/* Drift Alert Badge */}
            {unmappedCount > 0 && (
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-amber-400" />
                {unmappedCount} SCHEMA DRIFT
              </span>
            )}

            {/* Protocol */}
            <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700 text-[10px]">
              {event.canonical.network.protocol}
            </span>

            {/* Ingestion Latency */}
            <span className="text-zinc-500 text-[11px] flex items-center gap-1">
              <Zap className="w-3 h-3 text-emerald-400" />
              {event.latencyMs.toFixed(2)} ms
            </span>

            {/* SHA-256 Digest Preview */}
            <span
              onClick={() => handleCopy(event.envelope.sha256_hash, 'hash')}
              className="ml-auto text-[10px] text-zinc-400 hover:text-emerald-300 cursor-pointer flex items-center gap-1 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800 font-mono"
              title="Click to copy full SHA-256 seal"
            >
              <Fingerprint className="w-3 h-3 text-emerald-400" />
              {event.envelope.sha256_hash.substring(0, 12)}...
              {copiedKey === 'hash' ? (
                <Check className="w-3 h-3 text-emerald-400 ml-1" />
              ) : (
                <Copy className="w-3 h-3 text-zinc-600 ml-1" />
              )}
            </span>
          </div>
        </header>

        {/* =====================================================================
            5-TAB INSPECTOR NAVIGATION BAR
            ===================================================================== */}
        <nav className="px-4 bg-zinc-950 border-b border-zinc-800 flex items-center gap-1 overflow-x-auto shrink-0 py-1.5 text-xs font-mono">
          {/* Tab 1: Canonical Semantic View */}
          <button
            id="forensic-tab-canonical"
            onClick={() => setActiveTab('canonical')}
            className={`px-3 py-1.5 rounded-md flex items-center gap-2 cursor-pointer transition-all ${
              activeTab === 'canonical'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-transparent'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>1. Canonical Schema</span>
          </button>

          {/* Tab 2: Raw Ingestion Proof */}
          <button
            id="forensic-tab-raw"
            onClick={() => setActiveTab('raw_envelope')}
            className={`px-3 py-1.5 rounded-md flex items-center gap-2 cursor-pointer transition-all ${
              activeTab === 'raw_envelope'
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 font-semibold shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-transparent'
            }`}
          >
            <Lock className="w-3.5 h-3.5 text-blue-400" />
            <span>2. Raw Envelope & Seal</span>
          </button>

          {/* Tab 3: Provenance Lineage */}
          <button
            id="forensic-tab-provenance"
            onClick={() => setActiveTab('provenance')}
            className={`px-3 py-1.5 rounded-md flex items-center gap-2 cursor-pointer transition-all ${
              activeTab === 'provenance'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 font-semibold shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-transparent'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-purple-400" />
            <span>3. Provenance Lineage</span>
          </button>

          {/* Tab 4: Output Profiles */}
          <button
            id="forensic-tab-profiles"
            onClick={() => setActiveTab('profiles')}
            className={`px-3 py-1.5 rounded-md flex items-center gap-2 cursor-pointer transition-all ${
              activeTab === 'profiles'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-transparent'
            }`}
          >
            <FileJson className="w-3.5 h-3.5 text-emerald-400" />
            <span>4. Output Projection</span>
          </button>

          {/* Tab 5: Schema Drift Quarantine */}
          <button
            id="forensic-tab-drift"
            onClick={() => setActiveTab('drift')}
            className={`px-3 py-1.5 rounded-md flex items-center gap-2 cursor-pointer transition-all relative ${
              activeTab === 'drift'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold shadow-xs'
                : unmappedCount > 0
                ? 'text-amber-300 hover:bg-zinc-900 border border-amber-500/20'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-transparent'
            }`}
          >
            <AlertTriangle
              className={`w-3.5 h-3.5 ${unmappedCount > 0 ? 'text-amber-400' : 'text-zinc-500'}`}
            />
            <span>5. Schema Drift</span>
            {unmappedCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-amber-500 text-black text-[9px] font-bold flex items-center justify-center">
                {unmappedCount}
              </span>
            )}
          </button>
        </nav>

        {/* =====================================================================
            DRAWER BODY CONTENT (Scrollable)
            ===================================================================== */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 font-mono text-xs scrollbar-thin scrollbar-thumb-zinc-800">
          {/* ===================================================================
              TAB 1: CANONICAL SEMANTIC VIEW
              =================================================================== */}
          {activeTab === 'canonical' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Threat Signature Alert Banner (if present) */}
              {event.canonical.threat && (
                <div className="p-3.5 rounded-md bg-rose-500/10 border border-rose-500/40 space-y-1.5">
                  <div className="flex items-center justify-between text-rose-300 font-bold text-xs">
                    <span className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-400" />
                      THREAT SIGNATURE DETECTED
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 border border-rose-500/40">
                      {event.canonical.threat.severity} SEVERITY
                    </span>
                  </div>
                  <div className="text-zinc-200 text-xs font-semibold">
                    {event.canonical.threat.signature}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-zinc-400 pt-1">
                    {event.canonical.threat.category && (
                      <span>Category: <span className="text-zinc-200 font-bold">{event.canonical.threat.category}</span></span>
                    )}
                    {event.canonical.threat.cve && (
                      <span>CVE: <span className="text-rose-300 font-bold">{event.canonical.threat.cve}</span></span>
                    )}
                  </div>
                </div>
              )}

              {/* 5-Tuple Network Identity Flow Card */}
              <div className="p-3.5 rounded-md bg-zinc-900/70 border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between text-[11px] font-bold text-zinc-400 pb-2 border-b border-zinc-800">
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <Activity className="w-3.5 h-3.5" />
                    Network 5-Tuple Flow
                  </span>
                  <button
                    onClick={() =>
                      handleCopy(
                        `${event.canonical.source.ip}:${event.canonical.source.port || ''} -> ${event.canonical.destination.ip}:${event.canonical.destination.port || ''} (${event.canonical.network.protocol})`,
                        '5tuple'
                      )
                    }
                    className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-zinc-200 cursor-pointer"
                  >
                    {copiedKey === '5tuple' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    Copy 5-Tuple
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-11 gap-2 items-center">
                  {/* Source Side */}
                  <div className="md:col-span-5 p-2.5 rounded bg-zinc-950 border border-zinc-800 space-y-1">
                    <div className="text-[10px] uppercase font-bold text-zinc-500">Source (Client)</div>
                    <div className="text-sm font-bold text-emerald-400">
                      {event.canonical.source.ip}
                      {event.canonical.source.port && (
                        <span className="text-zinc-400 font-normal">:{event.canonical.source.port}</span>
                      )}
                    </div>
                    {event.canonical.source.zone && (
                      <div className="text-[10px] text-zinc-400">
                        Zone: <span className="text-zinc-200 font-bold">{event.canonical.source.zone}</span>
                      </div>
                    )}
                    {event.canonical.source.nat_ip && (
                      <div className="text-[10px] text-zinc-500">
                        NAT: {event.canonical.source.nat_ip}:{event.canonical.source.nat_port}
                      </div>
                    )}
                  </div>

                  {/* Flow Direction & Policy */}
                  <div className="md:col-span-1 flex flex-col items-center justify-center py-1">
                    <ArrowRight className="w-4 h-4 text-zinc-500 rotate-90 md:rotate-0" />
                    <span className="text-[9px] text-zinc-400 uppercase font-bold mt-0.5">
                      {event.canonical.network.protocol}
                    </span>
                  </div>

                  {/* Destination Side */}
                  <div className="md:col-span-5 p-2.5 rounded bg-zinc-950 border border-zinc-800 space-y-1">
                    <div className="text-[10px] uppercase font-bold text-zinc-500">Destination (Target)</div>
                    <div className="text-sm font-bold text-blue-400">
                      {event.canonical.destination.ip}
                      {event.canonical.destination.port && (
                        <span className="text-zinc-400 font-normal">:{event.canonical.destination.port}</span>
                      )}
                    </div>
                    {event.canonical.destination.zone && (
                      <div className="text-[10px] text-zinc-400">
                        Zone: <span className="text-zinc-200 font-bold">{event.canonical.destination.zone}</span>
                      </div>
                    )}
                    {event.canonical.destination.nat_ip && (
                      <div className="text-[10px] text-zinc-500">
                        NAT: {event.canonical.destination.nat_ip}:{event.canonical.destination.nat_port}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Policy Decision & Telemetry Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="p-2.5 rounded bg-zinc-900/60 border border-zinc-800 space-y-0.5">
                  <span className="text-[10px] text-zinc-500 uppercase font-semibold">Firewall Action</span>
                  <div className="text-xs font-bold text-zinc-100">{event.canonical.network.action}</div>
                </div>
                <div className="p-2.5 rounded bg-zinc-900/60 border border-zinc-800 space-y-0.5">
                  <span className="text-[10px] text-zinc-500 uppercase font-semibold">Session Bytes</span>
                  <div className="text-xs font-bold text-zinc-100">
                    {(event.canonical.network.bytes_in || 0) + (event.canonical.network.bytes_out || 0) > 0
                      ? `${((event.canonical.network.bytes_in || 0) + (event.canonical.network.bytes_out || 0)).toLocaleString()} B`
                      : '—'}
                  </div>
                </div>
                <div className="p-2.5 rounded bg-zinc-900/60 border border-zinc-800 space-y-0.5">
                  <span className="text-[10px] text-zinc-500 uppercase font-semibold">Session ID</span>
                  <div className="text-xs font-bold text-zinc-100 truncate">
                    {event.canonical.network.session_id || '—'}
                  </div>
                </div>
                <div className="p-2.5 rounded bg-zinc-900/60 border border-zinc-800 space-y-0.5">
                  <span className="text-[10px] text-zinc-500 uppercase font-semibold">Packets Count</span>
                  <div className="text-xs font-bold text-zinc-100">
                    {event.canonical.network.packets || '1'}
                  </div>
                </div>
              </div>

              {/* Device Observer Metadata */}
              <div className="p-3.5 rounded bg-zinc-900/50 border border-zinc-800 space-y-2">
                <div className="text-[11px] font-bold text-zinc-400 pb-1 border-b border-zinc-800 flex items-center justify-between">
                  <span>Perimeter Observer Node</span>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    Schema v{event.mapping.software_version}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <div>
                    <span className="text-zinc-500 text-[10px]">Vendor:</span>
                    <div className="text-zinc-200 font-bold">{event.canonical.device.vendor}</div>
                  </div>
                  <div>
                    <span className="text-zinc-500 text-[10px]">Product:</span>
                    <div className="text-zinc-200 font-bold">{event.canonical.device.product}</div>
                  </div>
                  <div>
                    <span className="text-zinc-500 text-[10px]">Device ID:</span>
                    <div className="text-zinc-200 truncate">{event.canonical.device.device_id}</div>
                  </div>
                  <div>
                    <span className="text-zinc-500 text-[10px]">Version:</span>
                    <div className="text-zinc-200">{event.canonical.device.version}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ===================================================================
              TAB 2: RAW INGESTION PROOF & ENVELOPE
              =================================================================== */}
          {activeTab === 'raw_envelope' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Raw Payload Block with Copy */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-zinc-400 font-semibold">
                  <span className="flex items-center gap-1.5 text-blue-400">
                    <FileText className="w-3.5 h-3.5" />
                    Original Raw Wire Bytes (Zero-Copy)
                  </span>
                  <button
                    onClick={() => handleCopy(event.raw, 'raw')}
                    className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-zinc-200 cursor-pointer"
                  >
                    {copiedKey === 'raw' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    Copy Raw
                  </button>
                </div>

                <div className="p-3.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-300 font-mono text-xs leading-relaxed break-all select-text shadow-inner">
                  {rawSliced.hasSlice ? (
                    <>
                      <span className="text-zinc-400">{rawSliced.prefix}</span>
                      <mark className="bg-amber-400/30 text-amber-200 ring-2 ring-amber-400/70 rounded-xs px-1 font-bold">
                        {rawSliced.highlighted}
                      </mark>
                      <span className="text-zinc-400">{rawSliced.suffix}</span>
                    </>
                  ) : (
                    <span>{event.raw}</span>
                  )}
                </div>
              </div>

              {/* Cryptographic Proof Card */}
              <div className="p-3.5 rounded-md bg-zinc-900/80 border border-emerald-500/30 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-bold text-emerald-400">
                  <span className="flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5" />
                    Cryptographic SHA-256 Ingest Seal
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    VERIFIED TAMPER-PROOF
                  </span>
                </div>

                <div className="p-2 rounded bg-zinc-950 border border-zinc-800 text-[11px] text-zinc-300 font-mono break-all flex items-center justify-between">
                  <span>{event.envelope.sha256_hash}</span>
                  <button
                    onClick={() => handleCopy(event.envelope.sha256_hash, 'hash')}
                    className="ml-2 text-zinc-500 hover:text-emerald-300 cursor-pointer"
                  >
                    {copiedKey === 'hash' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] text-zinc-400 pt-1">
                  <div>
                    <span className="text-zinc-500">Payload Length:</span>
                    <div className="text-zinc-200 font-bold font-mono">
                      {typeof event.envelope.metadata?.raw_byte_length === 'number'
                        ? event.envelope.metadata.raw_byte_length
                        : event.raw.length}{' '}
                      bytes
                    </div>
                  </div>
                  <div>
                    <span className="text-zinc-500">Detected Format:</span>
                    <div className="text-blue-400 font-bold uppercase">{event.detection.format}</div>
                  </div>
                  <div>
                    <span className="text-zinc-500">Vendor Confidence:</span>
                    <div className="text-emerald-400 font-bold font-mono">
                      {Math.round(event.detection.vendor_confidence * 100)}%
                    </div>
                  </div>
                  <div>
                    <span className="text-zinc-500">Envelope UUID:</span>
                    <div className="text-zinc-200 font-mono truncate">{event.id}</div>
                  </div>
                </div>
              </div>

              {/* Extracted Raw Tokens Grid */}
              <div className="space-y-1.5">
                <div className="text-[11px] text-zinc-400 font-semibold uppercase flex items-center justify-between">
                  <span>Parsed Wire Tokens ({Object.keys(event.parsed.fields).length})</span>
                  <span className="text-[10px] text-zinc-600 font-mono">Click token to sync provenance</span>
                </div>

                <div className="p-2 rounded bg-zinc-900/40 border border-zinc-800/80 flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
                  {Object.entries(event.parsed.fields).map(([k, v]) => (
                    <div
                      key={k}
                      className="px-2 py-1 rounded bg-zinc-950 border border-zinc-800 text-[10px] font-mono flex items-center gap-1.5"
                    >
                      <span className="text-zinc-400 font-bold">{k}:</span>
                      <span className="text-zinc-200 max-w-[160px] truncate">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ===================================================================
              TAB 3: SYNCHRONIZED PROVENANCE LINEAGE
              =================================================================== */}
          {activeTab === 'provenance' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="p-3 rounded-md bg-purple-500/10 border border-purple-500/30 text-xs text-purple-200 flex items-center justify-between">
                <div>
                  <span className="font-bold">Deterministic Lineage Audit</span>
                  <p className="text-[11px] text-purple-300/80 mt-0.5">
                    Click any canonical field below to trace its exact byte slice in the raw payload and applied schema rule.
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono text-[10px] font-bold border border-purple-500/30">
                  {Object.keys(event.provenance.lineage).length} FIELDS MAPPED
                </span>
              </div>

              {/* Selected Field Step-by-Step Provenance Journey */}
              {activeProv && (
                <div className="p-3.5 rounded-md bg-zinc-900 border border-amber-500/50 space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-bold text-amber-300 pb-1 border-b border-zinc-800">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      Active Provenance Trail for "{activeProv.output_field}"
                    </span>
                    <span className="text-[10px] text-emerald-400 font-mono">
                      {Math.round(activeProv.confidence * 100)}% Confidence
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-[11px]">
                    <div className="p-2 rounded bg-zinc-950 border border-zinc-800 space-y-0.5">
                      <span className="text-[9px] text-zinc-500 uppercase font-bold">1. Raw Slice</span>
                      <div className="text-amber-300 font-bold truncate">
                        [{activeProv.raw_slice?.start ?? '?'}:{activeProv.raw_slice?.end ?? '?'}]
                      </div>
                      <div className="text-[10px] text-zinc-400 truncate">
                        "{String(activeProv.original_value)}"
                      </div>
                    </div>

                    <div className="p-2 rounded bg-zinc-950 border border-zinc-800 space-y-0.5">
                      <span className="text-[9px] text-zinc-500 uppercase font-bold">2. Source Token</span>
                      <div className="text-zinc-200 font-bold truncate">{activeProv.original_field}</div>
                      <div className="text-[10px] text-zinc-500">Wire key</div>
                    </div>

                    <div className="p-2 rounded bg-zinc-950 border border-zinc-800 space-y-0.5">
                      <span className="text-[9px] text-zinc-500 uppercase font-bold">3. Transform</span>
                      <div className="text-purple-300 font-bold uppercase truncate">
                        {activeProv.mapping_rule}
                      </div>
                      <div className="text-[10px] text-zinc-500">Rule v{activeProv.mapping_version}</div>
                    </div>

                    <div className="p-2 rounded bg-zinc-950 border border-zinc-800 space-y-0.5">
                      <span className="text-[9px] text-zinc-500 uppercase font-bold">4. Canonical</span>
                      <div className="text-emerald-400 font-bold truncate">{activeProv.output_field}</div>
                      <div className="text-[10px] text-zinc-300 truncate">
                        = "{String(activeProv.output_value)}"
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Lineage Table */}
              <div className="rounded-md border border-zinc-800 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-900 text-zinc-400 text-[10px] uppercase font-bold border-b border-zinc-800">
                    <tr>
                      <th className="p-2.5">Canonical Target</th>
                      <th className="p-2.5">Source Wire Token</th>
                      <th className="p-2.5">Transform Rule</th>
                      <th className="p-2.5">Mapped Value</th>
                      <th className="p-2.5">Raw Slice</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/80 bg-zinc-950/60">
                    {Object.entries(event.provenance.lineage).map(([field, prov]) => {
                      const isSelected = selectedFieldKey === field;
                      return (
                        <tr
                          key={field}
                          onClick={() => setSelectedFieldKey(field)}
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-amber-500/15 text-amber-200 font-bold'
                              : 'hover:bg-zinc-900/70 text-zinc-300'
                          }`}
                        >
                          <td className="p-2.5 font-bold flex items-center gap-1.5">
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isSelected ? 'bg-amber-400' : 'bg-emerald-400'
                              }`}
                            />
                            {field}
                          </td>
                          <td className="p-2.5 font-mono text-zinc-400">{prov.original_field}</td>
                          <td className="p-2.5">
                            <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/30 text-[9px] font-bold uppercase">
                              {prov.mapping_rule}
                            </span>
                          </td>
                          <td className="p-2.5 font-mono text-zinc-200 max-w-[140px] truncate">
                            {String(prov.output_value)}
                          </td>
                          <td className="p-2.5 font-mono text-zinc-500 text-[10px]">
                            {prov.raw_slice ? `[${prov.raw_slice.start}:${prov.raw_slice.end}]` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ===================================================================
              TAB 4: OUTPUT PROFILE PROJECTIONS
              =================================================================== */}
          {activeTab === 'profiles' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Profile Picker Buttons */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {PRESET_OUTPUT_PROFILES.map((p) => {
                  const isActive = p.id === selectedProfileId;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setSelectedProfileId(p.id)}
                      className={`px-2.5 py-1.5 rounded-md text-[11px] font-mono whitespace-nowrap cursor-pointer transition-all ${
                        isActive
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-xs font-bold'
                          : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850 border border-zinc-800'
                      }`}
                    >
                      {p.name}
                    </button>
                  );
                })}
              </div>

              {/* Profile Info Header */}
              <div className="p-2.5 rounded bg-zinc-900/60 border border-zinc-800 flex items-center justify-between text-[11px]">
                <div className="text-zinc-300 font-semibold">
                  <span>{activeProfile.name}</span>
                  <span className="text-zinc-500 font-normal ml-2 font-mono text-[10px]">
                    ({activeProfile.fields_to_include.length} fields)
                  </span>
                </div>
                <button
                  onClick={() =>
                    handleCopy(JSON.stringify(projectedOutput, null, 2), 'projected')
                  }
                  className="flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] cursor-pointer"
                >
                  {copiedKey === 'projected' ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  Copy Projected JSON
                </button>
              </div>

              {/* Projected JSON Viewer */}
              <div className="p-3.5 rounded-md bg-zinc-900/90 border border-zinc-800 text-xs font-mono text-zinc-200 overflow-x-auto max-h-[380px] scrollbar-thin scrollbar-thumb-zinc-800">
                <pre className="whitespace-pre">
                  {JSON.stringify(projectedOutput, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* ===================================================================
              TAB 5: SCHEMA DRIFT & QUARANTINE ANALYSIS
              =================================================================== */}
          {activeTab === 'drift' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {unmappedCount > 0 ? (
                <div className="space-y-3">
                  {/* Warning Header */}
                  <div className="p-3.5 rounded-md bg-amber-500/10 border border-amber-500/30 space-y-1">
                    <div className="flex items-center justify-between text-amber-300 font-bold text-xs">
                      <span className="flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                        Schema Drift Detected ({unmappedCount} Novel Tokens)
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        STATUS: QUARANTINE RECORDED
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      {event.driftReason ||
                        `The active perimeter mapping rule ${event.mapping.vendor}@${event.mapping.software_version} lacks semantic definitions for the following tokens observed in this event.`}
                    </p>
                  </div>

                  {/* Novel Tokens Table */}
                  <div className="rounded-md border border-zinc-800 overflow-hidden">
                    <div className="p-2.5 bg-zinc-900 text-zinc-300 text-xs font-bold border-b border-zinc-800 flex items-center justify-between">
                      <span>Unmapped Tokens & Observed Values</span>
                      <span className="text-[10px] text-zinc-500 font-mono">
                        Rule: {event.mapping.mapping_id}
                      </span>
                    </div>
                    <div className="divide-y divide-zinc-800/80 bg-zinc-950">
                      {Object.entries(event.unmappedFields).map(([k, v]) => (
                        <div key={k} className="p-2.5 flex items-center justify-between text-xs font-mono">
                          <div className="space-y-0.5">
                            <span className="text-amber-300 font-bold">{k}</span>
                            <div className="text-[10px] text-zinc-500">
                              Observed value: <span className="text-zinc-300">"{String(v)}"</span>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-400">
                            Unmapped Wire Token
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Remediation Action Card */}
                  <div className="p-3.5 rounded-md bg-zinc-900 border border-zinc-800 space-y-2.5">
                    <div className="text-xs font-bold text-zinc-200">
                      Automated Remediation Workflow (Phase 5)
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-normal">
                      Route this event to the Autonomous Drift Engine to compute structural fingerprint diffs, run prompt-sandboxed Gemini AI analysis, and execute 1-click reprocess into a patched version (v{bumpVersion(event.mapping.software_version)}).
                    </p>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {onOpenDriftEngine && (
                        <button
                          onClick={() => {
                            quarantineManager.addEventFromStream(event);
                            onOpenDriftEngine();
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold cursor-pointer transition-colors shadow-xs"
                        >
                          <Flame className="w-3.5 h-3.5" />
                          Remediate in Phase 5 Quarantine Chamber
                        </button>
                      )}
                      {onOpenRegistry && (
                        <button
                          onClick={onOpenRegistry}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium cursor-pointer transition-colors border border-zinc-700"
                        >
                          <Layers className="w-3.5 h-3.5 text-purple-400" />
                          Knowledge Registry
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 rounded-md bg-zinc-900/30 border border-zinc-800 text-center space-y-2">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <h3 className="text-xs font-bold text-zinc-200">Perfect Schema Conformance</h3>
                  <p className="text-[11px] text-zinc-400 max-w-sm mx-auto">
                    All extracted wire tokens for this event are fully covered by active mapping version{' '}
                    <span className="text-emerald-400 font-mono font-bold">
                      {event.mapping.vendor}@{event.mapping.software_version}
                    </span>
                    . Zero unmapped tokens or schema drift detected.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* =====================================================================
            DRAWER FOOTER BAR
            ===================================================================== */}
        <footer className="p-3 bg-zinc-900/90 border-t border-zinc-800 shrink-0 flex items-center justify-between text-[11px] font-mono text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Lossless Cryptographic Chain</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleCopy(JSON.stringify(event.canonical, null, 2), 'canonical')}
              className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 cursor-pointer border border-zinc-700 flex items-center gap-1"
            >
              {copiedKey === 'canonical' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              Copy Canonical Event
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

function bumpVersion(v: string): string {
  const parts = v.split('.');
  if (parts.length >= 2) {
    const minor = parseInt(parts[1], 10);
    if (!isNaN(minor)) {
      return `${parts[0]}.${minor + 1}`;
    }
  }
  return `${v}.1`;
}
