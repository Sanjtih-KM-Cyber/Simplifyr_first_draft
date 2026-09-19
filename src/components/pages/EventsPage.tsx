/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card.tsx';
import { Button } from '../ui/button.tsx';
import { Input } from '../ui/input.tsx';
import { Badge } from '../ui/badge.tsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table.tsx';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs.tsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog.tsx';
import {
  Search,
  Download,
  Eye,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  FileCode,
  Code,
  Database,
  Globe,
  Link as LinkIcon,
  ShieldCheck,
  Lock,
  Pause,
  Play,
  Sparkles,
  UploadCloud,
  Radio,
} from 'lucide-react';
import { ProcessedStreamEvent } from '../../types.ts';
import { formatRelativeTime, getStatusColor, formatBytes } from '../../lib/utils.ts';
import { streamSimulator } from '../../services/streamSimulator.ts';
import { IngestLogsModal } from '../common/IngestLogsModal.tsx';
import { IngestDropzone } from '../common/IngestDropzone.tsx';

interface EventsPageProps {
  events: ProcessedStreamEvent[];
  onSelectEvent?: (event: ProcessedStreamEvent) => void;
  selectedEventId?: string | null;
  isStreamRunning: boolean;
  onToggleStream: () => void;
  onInjectSingleEvent: () => void;
  onEventsIngested?: (newEvents: ProcessedStreamEvent[]) => void;
}

export const EventsPage: React.FC<EventsPageProps> = ({
  events,
  onSelectEvent,
  selectedEventId,
  isStreamRunning,
  onToggleStream,
  onInjectSingleEvent,
  onEventsIngested,
}) => {
  const [page, setPage] = useState(1);
  const pageSize = 15;
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedEvent, setSelectedEvent] = useState<ProcessedStreamEvent | null>(null);
  const [copiedTab, setCopiedTab] = useState<string | null>(null);
  const [isIngestModalOpen, setIsIngestModalOpen] = useState(false);

  const seenIds = new Set<string>();
  const filteredEvents = events.filter((ev) => {
    if (seenIds.has(ev.id)) return false;
    seenIds.add(ev.id);

    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      ev.id.toLowerCase().includes(q) ||
      ev.envelope.sha256_hash.toLowerCase().includes(q) ||
      ev.canonical.source?.ip?.toLowerCase().includes(q) ||
      ev.canonical.destination?.ip?.toLowerCase().includes(q) ||
      ev.detection.vendor.toLowerCase().includes(q) ||
      ev.raw.toLowerCase().includes(q);

    const matchesSource =
      sourceFilter === 'all' || ev.detection.vendor === sourceFilter;

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'drift' && ev.isDrift) ||
      (statusFilter === 'processed' && !ev.isDrift);

    return matchesSearch && matchesSource && matchesStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / pageSize));
  const paginatedEvents = filteredEvents.slice((page - 1) * pageSize, page * pageSize);

  const handleCopy = (text: string, tab: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTab(tab);
    setTimeout(() => setCopiedTab(null), 1500);
  };

  const handleDownload = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100 font-sans">Event Explorer</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Search, filter, and forensically inspect processed perimeter telemetry with cryptographic provenance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="emerald"
            size="sm"
            onClick={() => setIsIngestModalOpen(true)}
            title="Ingest your own raw log files or text into ULPF"
          >
            <UploadCloud className="mr-1.5 h-3.5 w-3.5" />
            Ingest Logs
          </Button>

          <Button
            variant={isStreamRunning ? 'outline' : 'secondary'}
            size="sm"
            onClick={onToggleStream}
            title={isStreamRunning ? 'Pause the diagnostic sandbox pulse' : 'Pulse diagnostic sandbox telemetry'}
            className="text-xs font-mono"
          >
            {isStreamRunning ? (
              <>
                <Pause className="mr-1.5 h-3.5 w-3.5 text-amber-400" />
                Pause Pulse
              </>
            ) : (
              <>
                <Radio className="mr-1.5 h-3.5 w-3.5 text-zinc-400" />
                Sandbox Pulse
              </>
            )}
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={onInjectSingleEvent}
            title="Inject a single test perimeter log into the pipeline"
          >
            <Sparkles className="mr-1.5 h-3.5 w-3.5 text-emerald-400" />
            Inject 1 Event
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDownload(JSON.stringify(events, null, 2), `simplifyr-events-${Date.now()}.json`)}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export
          </Button>
        </div>
      </div>

      {/* Unified Ingest Dropzone & Quick Paste Bar */}
      <IngestDropzone
        onEventsIngested={(newEvents) => {
          if (onEventsIngested) onEventsIngested(newEvents);
        }}
        onInjectSinglePulse={onInjectSingleEvent}
      />

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
          <Input
            placeholder="Search events (IP, ID, hash, payload)..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>

        <select
          value={sourceFilter}
          onChange={(e) => {
            setSourceFilter(e.target.value);
            setPage(1);
          }}
          className="h-9 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-xs text-zinc-200 font-mono"
        >
          <option value="all">All Vendors</option>
          <option value="palo_alto">Palo Alto</option>
          <option value="cisco_asa">Cisco ASA</option>
          <option value="fortinet_fortigate">Fortinet</option>
          <option value="checkpoint_quantum">Check Point</option>
          <option value="snort_ids">Snort 3</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="h-9 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-xs text-zinc-200 font-mono"
        >
          <option value="all">All Pipeline Statuses</option>
          <option value="processed">Processed (Zero-Loss)</option>
          <option value="drift">Schema Drift Quarantined</option>
        </select>
      </div>

      {/* Events Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event ID</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Source Device</TableHead>
                <TableHead>Format</TableHead>
                <TableHead>Src IP</TableHead>
                <TableHead>Dst IP</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Inspect</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedEvents.map((ev, index) => {
                const action = ev.canonical.network?.action?.toUpperCase() || 'UNKNOWN';
                const isBlocked = action === 'DENY' || action === 'DROP' || action === 'BLOCKED' || action === 'RESET';
                return (
                  <TableRow
                    key={`${ev.id}-${(page - 1) * pageSize + index}`}
                    className={`cursor-pointer transition-colors ${
                      selectedEventId === ev.id
                        ? 'bg-emerald-500/10 hover:bg-emerald-500/15 border-l-2 border-emerald-500'
                        : 'hover:bg-zinc-800/60'
                    }`}
                    onClick={() => {
                      if (onSelectEvent) onSelectEvent(ev);
                      else setSelectedEvent(ev);
                    }}
                  >
                    <TableCell className="font-mono text-[11px] text-zinc-300 max-w-[120px] truncate">
                      {ev.id.slice(0, 13)}...
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-zinc-400">
                      {formatRelativeTime(ev.timestamp)}
                    </TableCell>
                    <TableCell className="text-zinc-200 font-medium">
                      <span className="capitalize">{ev.detection.vendor.replace('_', ' ')}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] uppercase font-mono">
                        {ev.detection.format}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-zinc-300">
                      {ev.canonical.source?.ip || '—'}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-zinc-300">
                      {ev.canonical.destination?.ip || '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={isBlocked ? 'destructive' : 'success'} className="text-[10px] font-mono">
                        {action}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {ev.isDrift ? (
                        <Badge variant="warning" className="text-[10px] font-mono">
                          DRIFT QUARANTINE
                        </Badge>
                      ) : (
                        <Badge variant="success" className="text-[10px] font-mono">
                          SEALED 100%
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onSelectEvent) onSelectEvent(ev);
                          else setSelectedEvent(ev);
                        }}
                      >
                        <Eye className="h-3.5 w-3.5 text-zinc-400" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {paginatedEvents.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-10 text-zinc-500 text-xs">
                    No matching events found. Click "Inject Pulse" or "Resume Stream" to ingest logs.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          <div className="flex items-center justify-between p-3 border-t border-zinc-800/80 text-xs text-zinc-400">
            <span>
              Showing {filteredEvents.length === 0 ? 0 : (page - 1) * pageSize + 1} to{' '}
              {Math.min(page * pageSize, filteredEvents.length)} of {filteredEvents.length} events
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                Previous
              </Button>
              <span className="font-mono text-[11px] text-zinc-400 px-2">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Next
                <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Forensic Event Detail Modal with the 5 Inspiration Tabs */}
      {selectedEvent && (
        <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <div className="flex flex-wrap items-center justify-between gap-2 pr-6">
                <div>
                  <DialogTitle className="font-mono text-base flex items-center gap-2">
                    <span>Event Detail: {selectedEvent.id.slice(0, 16)}</span>
                  </DialogTitle>
                  <p className="text-xs text-zinc-400 font-mono mt-0.5">
                    {selectedEvent.detection.vendor} • {selectedEvent.detection.format}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <Badge variant="outline" className="uppercase font-mono text-[10px]">
                    {selectedEvent.detection.format}
                  </Badge>
                  {selectedEvent.isDrift ? (
                    <Badge variant="warning" className="text-[10px]">QUARANTINED</Badge>
                  ) : (
                    <Badge variant="success" className="text-[10px]">PROCESSED</Badge>
                  )}
                </div>
              </div>
            </DialogHeader>

            {/* 4 Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
              <div className="p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800">
                <span className="text-[10px] font-mono text-zinc-500 uppercase block">Timestamp</span>
                <span className="text-xs font-mono font-medium text-zinc-200 truncate block">
                  {new Date(selectedEvent.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800">
                <span className="text-[10px] font-mono text-zinc-500 uppercase block">Latency SLA</span>
                <span className="text-xs font-mono font-medium text-emerald-400 block">
                  {selectedEvent.latencyMs.toFixed(2)} ms
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800">
                <span className="text-[10px] font-mono text-zinc-500 uppercase block">Raw Payload Size</span>
                <span className="text-xs font-mono font-medium text-zinc-200 block">
                  {formatBytes(selectedEvent.raw.length)}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800">
                <span className="text-[10px] font-mono text-zinc-500 uppercase block">SHA-256 Seal</span>
                <span className="text-xs font-mono font-medium text-amber-300 truncate block">
                  {selectedEvent.envelope.sha256_hash.slice(0, 10)}...
                </span>
              </div>
            </div>

            {/* The 5 Clean Tabs: RAW, PARSED, NORMALIZED, OUTPUT, PROVENANCE */}
            <Tabs defaultValue="raw" className="space-y-3">
              <TabsList className="w-full justify-start overflow-x-auto">
                <TabsTrigger value="raw" className="flex items-center gap-1.5">
                  <FileCode className="h-3.5 w-3.5 text-blue-400" />
                  RAW
                </TabsTrigger>
                <TabsTrigger value="parsed" className="flex items-center gap-1.5">
                  <Code className="h-3.5 w-3.5 text-purple-400" />
                  PARSED
                </TabsTrigger>
                <TabsTrigger value="semantic" className="flex items-center gap-1.5">
                  <Database className="h-3.5 w-3.5 text-emerald-400" />
                  NORMALIZED
                </TabsTrigger>
                <TabsTrigger value="output" className="flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-sky-400" />
                  OUTPUT
                </TabsTrigger>
                <TabsTrigger value="provenance" className="flex items-center gap-1.5">
                  <LinkIcon className="h-3.5 w-3.5 text-amber-400" />
                  PROVENANCE
                </TabsTrigger>
              </TabsList>

              {/* RAW TAB */}
              <TabsContent value="raw">
                <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <span className="font-mono text-[11px] text-zinc-500">
                      Untouched Raw Log Payload ({selectedEvent.raw.length} bytes)
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[11px]"
                        onClick={() => handleCopy(selectedEvent.raw, 'raw')}
                      >
                        {copiedTab === 'raw' ? <Check className="h-3 w-3 text-emerald-400 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                        {copiedTab === 'raw' ? 'Copied' : 'Copy'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[11px]"
                        onClick={() => handleDownload(selectedEvent.raw, `raw-event-${selectedEvent.id}.log`)}
                      >
                        <Download className="h-3 w-3 mr-1" />
                        Download
                      </Button>
                    </div>
                  </div>
                  <pre className="font-mono text-xs text-zinc-200 whitespace-pre-wrap break-all p-2 rounded bg-zinc-900/60 max-h-60 overflow-y-auto">
                    {selectedEvent.raw}
                  </pre>
                  <div className="text-[11px] font-mono text-zinc-500 pt-1 flex items-center gap-1">
                    <Lock className="h-3 w-3 text-amber-400" />
                    <span>Cryptographic Seal: {selectedEvent.envelope.sha256_hash}</span>
                  </div>
                </div>
              </TabsContent>

              {/* PARSED TAB */}
              <TabsContent value="parsed">
                <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <span className="font-mono text-[11px] text-zinc-500">AST Parsed Key-Value Pairs</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[11px]"
                      onClick={() => handleCopy(JSON.stringify(selectedEvent.parsed, null, 2), 'parsed')}
                    >
                      {copiedTab === 'parsed' ? <Check className="h-3 w-3 text-emerald-400 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                      Copy JSON
                    </Button>
                  </div>
                  <pre className="font-mono text-xs text-zinc-200 whitespace-pre-wrap p-2 rounded bg-zinc-900/60 max-h-60 overflow-y-auto">
                    {JSON.stringify(selectedEvent.parsed, null, 2)}
                  </pre>
                </div>
              </TabsContent>

              {/* NORMALIZED TAB */}
              <TabsContent value="semantic">
                <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <span className="font-mono text-[11px] text-zinc-500">Normalized ECS / OCSF Canonical Model</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[11px]"
                      onClick={() => handleCopy(JSON.stringify(selectedEvent.canonical, null, 2), 'canonical')}
                    >
                      {copiedTab === 'canonical' ? <Check className="h-3 w-3 text-emerald-400 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                      Copy JSON
                    </Button>
                  </div>
                  <pre className="font-mono text-xs text-emerald-400 whitespace-pre-wrap p-2 rounded bg-zinc-900/60 max-h-60 overflow-y-auto">
                    {JSON.stringify(selectedEvent.canonical, null, 2)}
                  </pre>
                </div>
              </TabsContent>

              {/* OUTPUT TAB */}
              <TabsContent value="output">
                <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <span className="font-mono text-[11px] text-zinc-500">Active Profile Dispatch Projection</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[11px]"
                      onClick={() => handleCopy(JSON.stringify(selectedEvent.canonical, null, 2), 'output')}
                    >
                      {copiedTab === 'output' ? <Check className="h-3 w-3 text-emerald-400 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                      Copy Output
                    </Button>
                  </div>
                  <pre className="font-mono text-xs text-sky-400 whitespace-pre-wrap p-2 rounded bg-zinc-900/60 max-h-60 overflow-y-auto">
                    {JSON.stringify(
                      {
                        event_id: selectedEvent.id,
                        timestamp: selectedEvent.timestamp,
                        vendor: selectedEvent.detection.vendor,
                        action: selectedEvent.canonical.network?.action,
                        source_ip: selectedEvent.canonical.source?.ip,
                        dest_ip: selectedEvent.canonical.destination?.ip,
                        protocol: selectedEvent.canonical.network?.protocol,
                        tamper_proof_sha256: selectedEvent.envelope.sha256_hash,
                      },
                      null,
                      2
                    )}
                  </pre>
                </div>
              </TabsContent>

              {/* PROVENANCE TAB */}
              <TabsContent value="provenance">
                <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <span className="font-mono text-[11px] text-zinc-500">Immutable Audit Trail & Transformation Lineage</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[11px]"
                      onClick={() => handleCopy(JSON.stringify(selectedEvent.provenance, null, 2), 'provenance')}
                    >
                      {copiedTab === 'provenance' ? <Check className="h-3 w-3 text-emerald-400 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                      Copy Provenance
                    </Button>
                  </div>
                  <pre className="font-mono text-xs text-amber-300 whitespace-pre-wrap p-2 rounded bg-zinc-900/60 max-h-60 overflow-y-auto">
                    {JSON.stringify(selectedEvent.provenance, null, 2)}
                  </pre>
                </div>
              </TabsContent>
            </Tabs>

            <div className="pt-3 border-t border-zinc-800/80 flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setSelectedEvent(null)}>
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Live Logs Ingestion Modal */}
      <IngestLogsModal
        isOpen={isIngestModalOpen}
        onClose={() => setIsIngestModalOpen(false)}
        onEventsIngested={(newEvents) => {
          if (onEventsIngested) {
            onEventsIngested(newEvents);
          }
        }}
      />
    </div>
  );
};
