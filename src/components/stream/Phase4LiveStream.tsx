/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Zap,
  Shield,
  AlertTriangle,
  Flame,
  Layers,
  Search,
  SlidersHorizontal,
  ChevronRight,
  Eye,
  Lock,
  CheckCircle2,
  Download,
  Filter,
  ArrowRight,
  Activity,
  Fingerprint,
  RefreshCw,
  Sparkles,
  ExternalLink,
  ChevronDown,
} from 'lucide-react';
import { ProcessedStreamEvent, PerimeterVendor } from '../../types.ts';
import { streamSimulator } from '../../services/streamSimulator.ts';
import { ForensicDrawer } from './ForensicDrawer.tsx';
import { GOLDEN_CORPUS } from '../../data/goldenCorpus.ts';
import { quarantineManager } from '../../services/quarantineManager.ts';

interface Phase4LiveStreamProps {
  onEventProcessed?: (latency: number) => void;
  onOpenRegistry?: () => void;
  onOpenDriftEngine?: () => void;
}

export const Phase4LiveStream: React.FC<Phase4LiveStreamProps> = ({
  onEventProcessed,
  onOpenRegistry,
  onOpenDriftEngine,
}) => {
  // 1. Live Event Buffer State (holds up to 300 recent stream events)
  const [events, setEvents] = useState<ProcessedStreamEvent[]>([]);
  const [isStreaming, setIsStreaming] = useState<boolean>(true);
  const [eps, setEps] = useState<number>(2);
  const [pauseOnInspect, setPauseOnInspect] = useState<boolean>(true);

  // 2. Forensic Drawer Selection State
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  // 3. Search & Filter State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [vendorFilter, setVendorFilter] = useState<string>('ALL');
  const [actionFilter, setActionFilter] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [driftOnly, setDriftOnly] = useState<boolean>(false);
  const [attacksOnly, setAttacksOnly] = useState<boolean>(false);

  // 4. Session Telemetry Stats
  const [stats, setStats] = useState({
    totalIngested: 0,
    blockedCount: 0,
    allowedCount: 0,
    alertCount: 0,
    driftCount: 0,
    attackCount: 0,
  });

  const tableEndRef = useRef<HTMLDivElement>(null);
  const isStreamingRef = useRef<boolean>(isStreaming);
  isStreamingRef.current = isStreaming;

  // Handle incoming stream event from simulator
  const handleNewEvent = useCallback(
    (newEvent: ProcessedStreamEvent) => {
      setEvents((prev) => {
        // Keep most recent 250 events
        const updated = [newEvent, ...prev.slice(0, 249)];
        return updated;
      });

      setStats((prev) => ({
        totalIngested: prev.totalIngested + 1,
        blockedCount: prev.blockedCount + (newEvent.canonical.network.action === 'BLOCKED' ? 1 : 0),
        allowedCount: prev.allowedCount + (newEvent.canonical.network.action === 'ALLOWED' ? 1 : 0),
        alertCount: prev.alertCount + (newEvent.canonical.network.action === 'ALERT' ? 1 : 0),
        driftCount: prev.driftCount + (newEvent.isDrift ? 1 : 0),
        attackCount: prev.attackCount + (newEvent.isAttack ? 1 : 0),
      }));

      // Route drift events automatically into Quarantine Buffer
      if (newEvent.isDrift) {
        quarantineManager.addEventFromStream(newEvent);
      }

      if (onEventProcessed) {
        onEventProcessed(newEvent.latencyMs);
      }
    },
    [onEventProcessed]
  );

  // Initialize stream simulator on mount
  useEffect(() => {
    streamSimulator.setCallback(handleNewEvent);

    // Populate with 8 initial realistic events immediately so table is never blank
    for (let i = 0; i < 8; i++) {
      streamSimulator.pulse({ isAttack: i % 3 === 0, isDrift: i === 5 });
    }

    // Start live generator
    streamSimulator.start(eps);
    setIsStreaming(true);

    return () => {
      streamSimulator.stop();
    };
  }, []);

  // Update EPS when user changes speed
  const handleSpeedChange = (newEps: number) => {
    setEps(newEps);
    streamSimulator.setSpeed(newEps);
  };

  // Toggle Play / Pause
  const handleToggleStream = () => {
    if (isStreaming) {
      streamSimulator.stop();
      setIsStreaming(false);
    } else {
      streamSimulator.start(eps);
      setIsStreaming(true);
    }
  };

  // Inject High-Severity Attack on demand
  const handleInjectAttack = () => {
    streamSimulator.pulse({ isAttack: true });
  };

  // Inject Schema Drift on demand
  const handleInjectDrift = () => {
    streamSimulator.pulse({ isDrift: true });
  };

  // Pulse 1 single event
  const handlePulseOne = () => {
    streamSimulator.pulse();
  };

  // Clear Event Buffer
  const handleClearBuffer = () => {
    setEvents([]);
  };

  // Inspect Event -> Opens 5-Tab Forensic Drawer
  const handleSelectEvent = (event: ProcessedStreamEvent) => {
    setSelectedEventId(event.id);
    setIsDrawerOpen(true);

    // If configured, pause stream to freeze inspection
    if (pauseOnInspect && isStreaming) {
      streamSimulator.stop();
      setIsStreaming(false);
    }
  };

  // Filter events based on active controls
  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      // Vendor filter
      if (vendorFilter !== 'ALL' && ev.detection.vendor !== vendorFilter) {
        return false;
      }

      // Action filter
      if (actionFilter !== 'ALL' && ev.canonical.network.action !== actionFilter) {
        return false;
      }

      // Severity filter
      if (severityFilter !== 'ALL') {
        const sev = ev.canonical.threat?.severity || 'INFORMATIONAL';
        if (sev !== severityFilter) return false;
      }

      // Drift Only
      if (driftOnly && !ev.isDrift) {
        return false;
      }

      // Attacks Only
      if (attacksOnly && !ev.isAttack) {
        return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesSrc = ev.canonical.source.ip.toLowerCase().includes(q);
        const matchesDst = ev.canonical.destination.ip.toLowerCase().includes(q);
        const matchesVendor = ev.detection.vendor.toLowerCase().includes(q);
        const matchesRaw = ev.raw.toLowerCase().includes(q);
        const matchesSig = ev.canonical.threat?.signature?.toLowerCase().includes(q) ?? false;
        const matchesId = ev.id.toLowerCase().includes(q);
        const matchesProto = ev.canonical.network.protocol.toLowerCase().includes(q);
        if (
          !matchesSrc &&
          !matchesDst &&
          !matchesVendor &&
          !matchesRaw &&
          !matchesSig &&
          !matchesId &&
          !matchesProto
        ) {
          return false;
        }
      }

      return true;
    });
  }, [events, vendorFilter, actionFilter, severityFilter, driftOnly, attacksOnly, searchQuery]);

  // Selected event object for drawer
  const selectedEvent = useMemo(() => {
    return events.find((e) => e.id === selectedEventId) || null;
  }, [events, selectedEventId]);

  const selectedIndex = useMemo(() => {
    if (!selectedEventId) return -1;
    return filteredEvents.findIndex((e) => e.id === selectedEventId);
  }, [filteredEvents, selectedEventId]);

  const handleNextEvent = () => {
    if (selectedIndex >= 0 && selectedIndex < filteredEvents.length - 1) {
      setSelectedEventId(filteredEvents[selectedIndex + 1].id);
    }
  };

  const handlePrevEvent = () => {
    if (selectedIndex > 0) {
      setSelectedEventId(filteredEvents[selectedIndex - 1].id);
    }
  };

  return (
    <div
      id="phase4-live-stream-workspace"
      className="flex flex-col h-full w-full bg-zinc-950 text-zinc-100 overflow-hidden font-sans select-none"
    >
      {/* =======================================================================
          TOP STREAM CONTROL & SIMULATOR TOOLBAR
          ======================================================================= */}
      <header className="px-4 py-2.5 bg-zinc-900/90 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
        {/* Title & Live Engine Badge */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full shadow-xs ${
                isStreaming
                  ? 'bg-emerald-400 animate-pulse shadow-emerald-400'
                  : 'bg-amber-400 shadow-amber-400'
              }`}
            />
            <h2 className="text-sm font-semibold tracking-wide text-zinc-100 flex items-center gap-2">
              <span>UNIFIED LIVE STREAM</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 font-bold uppercase">
                Phase 4
              </span>
            </h2>
          </div>

          <span className="text-zinc-600 hidden sm:inline">|</span>

          {/* Stream Play/Pause Toggle */}
          <button
            id="stream-play-pause-btn"
            onClick={handleToggleStream}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold cursor-pointer border transition-all ${
              isStreaming
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 hover:bg-emerald-500/30'
                : 'bg-amber-500/20 text-amber-300 border-amber-500/50 hover:bg-amber-500/30'
            }`}
          >
            {isStreaming ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>Pause Stream</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Resume Stream</span>
              </>
            )}
          </button>

          {/* EPS Speed Presets */}
          <div className="hidden md:flex items-center gap-1 bg-zinc-950 p-0.5 rounded border border-zinc-800 text-[11px] font-mono">
            <span className="text-zinc-500 px-1.5 text-[10px] uppercase font-bold">Rate:</span>
            {[0.5, 1, 2, 5, 10].map((rate) => (
              <button
                key={rate}
                onClick={() => handleSpeedChange(rate)}
                className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                  eps === rate
                    ? 'bg-zinc-800 text-emerald-400 font-bold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {rate} eps
              </button>
            ))}
          </div>
        </div>

        {/* Action Injections & Quick Actions */}
        <div className="flex items-center gap-2">
          {/* Step 1 Event */}
          <button
            onClick={handlePulseOne}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium cursor-pointer border border-zinc-700 transition-colors"
            title="Inject single realistic perimeter event"
          >
            <RefreshCw className="w-3 h-3" />
            <span className="hidden lg:inline">Step 1</span>
          </button>

          {/* Attack Injector */}
          <button
            id="btn-inject-attack"
            onClick={handleInjectAttack}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-semibold cursor-pointer border border-rose-500/40 transition-colors shadow-xs"
            title="Inject real-world exploit probe (Log4j, SQLi, C2 Beacon)"
          >
            <Flame className="w-3.5 h-3.5 text-rose-400" />
            <span>Inject Attack</span>
          </button>

          {/* Schema Drift Injector */}
          <button
            id="btn-inject-drift"
            onClick={handleInjectDrift}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-semibold cursor-pointer border border-amber-500/40 transition-colors shadow-xs"
            title="Inject firmware update log with novel unmapped telemetry attributes"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span>Inject Drift</span>
          </button>

          {/* Clear Buffer */}
          <button
            onClick={handleClearBuffer}
            className="p-1.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 cursor-pointer"
            title="Clear Event Stream Buffer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* =======================================================================
          TELEMETRY SUMMARY HUD BAR
          ======================================================================= */}
      <div className="px-4 py-1.5 bg-zinc-950 border-b border-zinc-800/80 flex flex-wrap items-center justify-between text-xs font-mono shrink-0 gap-2">
        <div className="flex flex-wrap items-center gap-3 text-zinc-400">
          <span className="flex items-center gap-1">
            <span className="text-zinc-500">Buffer:</span>
            <span className="text-zinc-100 font-bold">{events.length}</span> / 250
          </span>
          <span className="text-zinc-700">|</span>
          <span className="flex items-center gap-1">
            <span className="text-zinc-500">Total Ingested:</span>
            <span className="text-emerald-400 font-bold">{stats.totalIngested}</span>
          </span>
          <span className="text-zinc-700">|</span>
          <span className="flex items-center gap-1">
            <span className="text-zinc-500">Blocked:</span>
            <span className="text-rose-400 font-bold">{stats.blockedCount}</span>
          </span>
          <span className="text-zinc-700">|</span>
          <span className="flex items-center gap-1">
            <span className="text-zinc-500">Allowed:</span>
            <span className="text-emerald-400 font-bold">{stats.allowedCount}</span>
          </span>
          <span className="text-zinc-700">|</span>
          <span className="flex items-center gap-1">
            <span className="text-zinc-500">Quarantine Drift:</span>
            <span className="text-amber-400 font-bold">{stats.driftCount}</span>
            {onOpenDriftEngine && stats.driftCount > 0 && (
              <button
                onClick={onOpenDriftEngine}
                className="ml-1 text-[10px] text-amber-300 hover:text-amber-100 underline underline-offset-2 cursor-pointer font-semibold"
              >
                Inspect Chamber →
              </button>
            )}
          </span>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-zinc-400">
          <label className="flex items-center gap-1.5 cursor-pointer text-zinc-400 hover:text-zinc-200">
            <input
              type="checkbox"
              checked={pauseOnInspect}
              onChange={(e) => setPauseOnInspect(e.target.checked)}
              className="rounded border-zinc-700 text-emerald-500 focus:ring-0 cursor-pointer"
            />
            <span>Pause stream on inspect</span>
          </label>
          <span className="text-zinc-700 hidden sm:inline">|</span>
          <span className="flex items-center gap-1 text-emerald-400 font-semibold">
            <Lock className="w-3 h-3" />
            100% Lossless SHA-256
          </span>
        </div>
      </div>

      {/* =======================================================================
          RICH FILTER & SEARCH BAR
          ======================================================================= */}
      <div className="px-4 py-2 bg-zinc-900/40 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-2.5 shrink-0 text-xs">
        {/* Left: Search input */}
        <div className="flex items-center gap-2 bg-zinc-900 px-2.5 py-1.5 rounded-md border border-zinc-700/80 flex-1 min-w-[240px] max-w-md">
          <Search className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search IP, port, vendor, signature, raw bytes..."
            className="bg-transparent border-none text-xs text-zinc-200 placeholder-zinc-500 focus:outline-hidden w-full font-mono"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-[10px] text-zinc-500 hover:text-zinc-300 font-mono"
            >
              CLEAR
            </button>
          )}
        </div>

        {/* Middle & Right: Filter Selectors & Toggles */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Vendor Filter */}
          <select
            value={vendorFilter}
            onChange={(e) => setVendorFilter(e.target.value)}
            className="bg-zinc-900 text-zinc-300 border border-zinc-700/80 rounded px-2 py-1 text-xs font-mono focus:outline-hidden cursor-pointer"
          >
            <option value="ALL">All Vendors</option>
            <option value="cisco_asa">Cisco ASA</option>
            <option value="palo_alto">Palo Alto</option>
            <option value="fortinet_fortigate">Fortinet FortiGate</option>
            <option value="checkpoint_quantum">Check Point</option>
            <option value="snort_ids">Snort IDS</option>
            <option value="generic_firewall">Cloud Gateway</option>
          </select>

          {/* Action Filter */}
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="bg-zinc-900 text-zinc-300 border border-zinc-700/80 rounded px-2 py-1 text-xs font-mono focus:outline-hidden cursor-pointer"
          >
            <option value="ALL">All Actions</option>
            <option value="BLOCKED">Blocked Only</option>
            <option value="ALLOWED">Allowed Only</option>
            <option value="ALERT">Alert Only</option>
          </select>

          {/* Severity Filter */}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="bg-zinc-900 text-zinc-300 border border-zinc-700/80 rounded px-2 py-1 text-xs font-mono focus:outline-hidden cursor-pointer"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="INFORMATIONAL">Informational</option>
          </select>

          {/* Schema Drift Filter Toggle */}
          <button
            onClick={() => setDriftOnly(!driftOnly)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-mono border transition-colors cursor-pointer ${
              driftOnly
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold'
                : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border-zinc-800'
            }`}
          >
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            <span>Drift Only</span>
          </button>

          {/* Attacks Only Toggle */}
          <button
            onClick={() => setAttacksOnly(!attacksOnly)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-mono border transition-colors cursor-pointer ${
              attacksOnly
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 font-bold'
                : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border-zinc-800'
            }`}
          >
            <Flame className="w-3 h-3 text-rose-400" />
            <span>Attacks Only</span>
          </button>
        </div>
      </div>

      {/* =======================================================================
          DENSE UNIFIED EVENT TABLE (SOC-Grade Grid)
          ======================================================================= */}
      <div className="flex-1 overflow-x-auto overflow-y-auto font-mono text-xs scrollbar-thin scrollbar-thumb-zinc-800">
        <table className="w-full text-left border-collapse min-w-[980px]">
          <thead className="bg-zinc-900/90 text-zinc-400 text-[10px] uppercase font-bold sticky top-0 z-10 border-b border-zinc-800 backdrop-blur-xs">
            <tr>
              <th className="py-2 px-3 w-28">Timestamp</th>
              <th className="py-2 px-2.5 w-20">Severity</th>
              <th className="py-2 px-2.5 w-24">Action</th>
              <th className="py-2 px-3 w-48">Source (5-Tuple)</th>
              <th className="py-2 px-1 w-6 text-center"></th>
              <th className="py-2 px-3 w-48">Destination</th>
              <th className="py-2 px-2 w-16">Proto</th>
              <th className="py-2 px-3 w-36">Perimeter Driver</th>
              <th className="py-2 px-3">Telemetry / Attack Signature</th>
              <th className="py-2 px-2.5 w-20 text-center">Seal</th>
              <th className="py-2 px-2.5 w-20 text-right">Inspect</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-zinc-800/60 bg-zinc-950/40">
            {filteredEvents.length === 0 ? (
              <tr>
                <td colSpan={11} className="py-12 text-center text-zinc-500">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Search className="w-6 h-6 text-zinc-600" />
                    <span>No events matching the active filter criteria.</span>
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setVendorFilter('ALL');
                        setActionFilter('ALL');
                        setSeverityFilter('ALL');
                        setDriftOnly(false);
                        setAttacksOnly(false);
                      }}
                      className="text-xs text-emerald-400 hover:underline mt-1 cursor-pointer"
                    >
                      Reset all filters
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              filteredEvents.map((ev) => {
                const isSelected = selectedEventId === ev.id && isDrawerOpen;
                const isCrit = ev.canonical.threat?.severity === 'CRITICAL';
                const isHigh = ev.canonical.threat?.severity === 'HIGH';

                return (
                  <tr
                    key={ev.id}
                    onClick={() => handleSelectEvent(ev)}
                    className={`group transition-colors cursor-pointer text-[11px] ${
                      isSelected
                        ? 'bg-emerald-500/15 text-zinc-100 ring-1 ring-emerald-500/50 font-medium'
                        : isCrit
                        ? 'bg-rose-500/5 hover:bg-rose-500/10 text-zinc-200'
                        : ev.isDrift
                        ? 'bg-amber-500/5 hover:bg-amber-500/10 text-zinc-200'
                        : 'hover:bg-zinc-900/80 text-zinc-300'
                    }`}
                  >
                    {/* Timestamp */}
                    <td className="py-2 px-3 text-zinc-400 whitespace-nowrap">
                      {ev.relativeTime}
                    </td>

                    {/* Severity Badge */}
                    <td className="py-2 px-2.5 whitespace-nowrap">
                      {ev.canonical.threat ? (
                        <span
                          className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${
                            isCrit
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                              : isHigh
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                          }`}
                        >
                          {ev.canonical.threat.severity.substring(0, 4)}
                        </span>
                      ) : (
                        <span className="text-[10px] text-zinc-600 font-mono">INFO</span>
                      )}
                    </td>

                    {/* Action Pill */}
                    <td className="py-2 px-2.5 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          ev.canonical.network.action === 'BLOCKED'
                            ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                            : ev.canonical.network.action === 'ALLOWED'
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                        }`}
                      >
                        {ev.canonical.network.action}
                      </span>
                    </td>

                    {/* Source IP:Port */}
                    <td className="py-2 px-3 text-zinc-200 whitespace-nowrap font-bold">
                      <span>{ev.canonical.source.ip}</span>
                      {ev.canonical.source.port && (
                        <span className="text-zinc-500 font-normal">:{ev.canonical.source.port}</span>
                      )}
                    </td>

                    {/* Direction Arrow */}
                    <td className="py-2 px-1 text-center text-zinc-600">➔</td>

                    {/* Destination IP:Port */}
                    <td className="py-2 px-3 text-zinc-300 whitespace-nowrap">
                      <span className="font-semibold text-zinc-200">{ev.canonical.destination.ip}</span>
                      {ev.canonical.destination.port && (
                        <span className="text-zinc-500">:{ev.canonical.destination.port}</span>
                      )}
                    </td>

                    {/* Protocol */}
                    <td className="py-2 px-2 text-zinc-400 font-bold whitespace-nowrap">
                      {ev.canonical.network.protocol}
                    </td>

                    {/* Vendor Driver */}
                    <td className="py-2 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="text-zinc-300 font-semibold">{formatVendorName(ev.detection.vendor)}</span>
                        <span className="text-[9px] px-1 py-0.2 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                          {ev.detection.format.split('_')[0].toUpperCase()}
                        </span>
                      </div>
                    </td>

                    {/* Telemetry / Signature / Drift Alert */}
                    <td className="py-2 px-3 max-w-xs truncate">
                      {ev.isDrift ? (
                        <span className="text-amber-300 flex items-center gap-1 font-semibold">
                          <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                          <span>Schema Drift: {Object.keys(ev.unmappedFields).join(', ')}</span>
                        </span>
                      ) : ev.canonical.threat?.signature ? (
                        <span className="text-rose-300 font-semibold truncate flex items-center gap-1">
                          <Flame className="w-3 h-3 text-rose-400 shrink-0" />
                          <span>{ev.canonical.threat.signature}</span>
                        </span>
                      ) : (
                        <span className="text-zinc-400 truncate">
                          Session: {ev.canonical.network.session_id || 'Active flow'} •{' '}
                          {ev.canonical.network.bytes_in || 0} bytes
                        </span>
                      )}
                    </td>

                    {/* Cryptographic Proof Seal */}
                    <td className="py-2 px-2.5 text-center whitespace-nowrap">
                      <span
                        className="inline-flex items-center gap-1 text-[10px] text-emerald-400"
                        title={`SHA-256 Validated: ${ev.envelope.sha256_hash}`}
                      >
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span className="font-mono text-[9px]">100%</span>
                      </span>
                    </td>

                    {/* Inspect Button */}
                    <td className="py-2 px-2.5 text-right whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectEvent(ev);
                        }}
                        className="px-2 py-1 rounded bg-zinc-800 hover:bg-emerald-500/20 hover:text-emerald-300 text-zinc-400 border border-zinc-700 cursor-pointer text-[10px] font-medium transition-colors"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
            <div ref={tableEndRef} />
          </tbody>
        </table>
      </div>

      {/* =======================================================================
          5-TAB FORENSIC SLIDE-OUT INSPECTOR DRAWER
          ======================================================================= */}
      <ForensicDrawer
        event={selectedEvent}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onPrevious={handlePrevEvent}
        onNext={handleNextEvent}
        hasPrevious={selectedIndex > 0}
        hasNext={selectedIndex < filteredEvents.length - 1}
        currentIndex={selectedIndex}
        totalEvents={filteredEvents.length}
        onOpenRegistry={onOpenRegistry}
        onOpenDriftEngine={onOpenDriftEngine}
      />
    </div>
  );
};

function formatVendorName(vendor: PerimeterVendor): string {
  switch (vendor) {
    case 'cisco_asa':
      return 'Cisco ASA';
    case 'palo_alto':
      return 'Palo Alto';
    case 'fortinet_fortigate':
      return 'FortiGate';
    case 'checkpoint_quantum':
      return 'Check Point';
    case 'snort_ids':
      return 'Snort IDS';
    case 'generic_firewall':
      return 'Cloud Gateway';
    default:
      return vendor;
  }
}
