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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog.tsx';
import { Label } from '../ui/label.tsx';
import { Textarea } from '../ui/textarea.tsx';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs.tsx';
import {
  Plus,
  Search,
  Server,
  Play,
  Pause,
  Copy,
  Check,
  CheckCircle,
  Sparkles,
  Lock,
  Terminal,
  FileCode,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { formatRelativeTime } from '../../lib/utils.ts';
import { GOLDEN_CORPUS } from '../../data/goldenCorpus.ts';
import { processRawEventThroughPipeline } from '../../services/streamSimulator.ts';
import { ProcessedStreamEvent } from '../../types.ts';

export interface SourceDevice {
  id: string;
  name: string;
  vendor: string;
  product: string;
  version: string;
  host: string;
  port: number;
  format: string;
  event_type: string;
  status: 'active' | 'inactive' | 'onboarding';
  last_event_at: string;
  event_count: number;
  error_count: number;
  sample_raw?: string;
}

export const INITIAL_SOURCES: SourceDevice[] = [
  {
    id: 'src-pa-01',
    name: 'Perimeter Firewall Primary',
    vendor: 'Palo Alto Networks',
    product: 'PA-3410 Next-Gen Firewall',
    version: 'PAN-OS 10.2',
    host: '192.168.1.1',
    port: 514,
    format: 'syslog_rfc5424',
    event_type: 'traffic',
    status: 'active',
    last_event_at: new Date().toISOString(),
    event_count: 0,
    error_count: 0,
    sample_raw: GOLDEN_CORPUS[0]?.raw,
  },
  {
    id: 'src-cisco-01',
    name: 'Core Edge Security Gateway',
    vendor: 'Cisco Systems',
    product: 'ASA 5525-X with Firepower',
    version: 'v9.18',
    host: '10.10.1.5',
    port: 514,
    format: 'syslog_rfc3164',
    event_type: 'connection_teardown',
    status: 'active',
    last_event_at: new Date().toISOString(),
    event_count: 0,
    error_count: 0,
    sample_raw: GOLDEN_CORPUS[1]?.raw,
  },
  {
    id: 'src-forti-01',
    name: 'Branch Edge FortiGate',
    vendor: 'Fortinet',
    product: 'FortiGate 100F',
    version: 'FortiOS 7.2',
    host: '172.16.1.10',
    port: 514,
    format: 'keyvalue',
    event_type: 'forward_traffic',
    status: 'active',
    last_event_at: new Date().toISOString(),
    event_count: 0,
    error_count: 0,
    sample_raw: GOLDEN_CORPUS[6]?.raw,
  },
  {
    id: 'src-checkpoint-01',
    name: 'Datacenter Boundary Inspection',
    vendor: 'Check Point',
    product: 'Quantum Security Gateway',
    version: 'R81.20',
    host: '10.0.10.1',
    port: 514,
    format: 'leef',
    event_type: 'network_drop',
    status: 'active',
    last_event_at: new Date().toISOString(),
    event_count: 0,
    error_count: 0,
    sample_raw: GOLDEN_CORPUS[3]?.raw,
  },
  {
    id: 'src-snort-01',
    name: 'DMZ Intrusion Detection Sensor',
    vendor: 'Cisco / Snort',
    product: 'Snort 3 Network IDS',
    version: '3.1.48',
    host: '10.10.4.50',
    port: 514,
    format: 'cef',
    event_type: 'intrusion_alert',
    status: 'active',
    last_event_at: new Date().toISOString(),
    event_count: 0,
    error_count: 0,
    sample_raw: GOLDEN_CORPUS[4]?.raw,
  },
  {
    id: 'src-cloud-01',
    name: 'Cloud Egress API Gateway',
    vendor: 'Generic Cloud',
    product: 'VPC Flow Proxy Gateway',
    version: '1.0',
    host: '10.0.3.15',
    port: 8443,
    format: 'json',
    event_type: 'egress_proxy',
    status: 'active',
    last_event_at: new Date().toISOString(),
    event_count: 0,
    error_count: 0,
    sample_raw: GOLDEN_CORPUS[5]?.raw,
  },
];

interface SourcesPageProps {
  initialWorkbenchPayload?: string;
  onOpenVerification?: () => void;
}

export const SourcesPage: React.FC<SourcesPageProps> = ({
  initialWorkbenchPayload,
  onOpenVerification,
}) => {
  const [activeTab, setActiveTab] = useState<'sources' | 'onboard'>(
    initialWorkbenchPayload ? 'onboard' : 'sources'
  );
  const [sources, setSources] = useState<SourceDevice[]>(INITIAL_SOURCES);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Detail Modal State
  const [selectedSourceForDetail, setSelectedSourceForDetail] = useState<SourceDevice | null>(null);

  // Interactive Onboarding State (Section 64)
  const [onboardRaw, setOnboardRaw] = useState<string>(
    initialWorkbenchPayload || GOLDEN_CORPUS[0]?.raw || ''
  );
  const [processedEvent, setProcessedEvent] = useState<ProcessedStreamEvent | null>(() => {
    try {
      return processRawEventThroughPipeline(initialWorkbenchPayload || GOLDEN_CORPUS[0]?.raw || '');
    } catch {
      return null;
    }
  });
  const [inspectView, setInspectView] = useState<'raw' | 'parsed' | 'normalized' | 'output'>('output');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [hasRegistered, setHasRegistered] = useState(false);

  const handleProcessOnboard = (text: string) => {
    setOnboardRaw(text);
    if (!text.trim()) {
      setProcessedEvent(null);
      return;
    }
    try {
      const res = processRawEventThroughPipeline(text.trim());
      setProcessedEvent(res);
      setHasRegistered(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectFixture = (index: number) => {
    const fixture = GOLDEN_CORPUS[index];
    if (fixture) {
      handleProcessOnboard(fixture.raw);
    }
  };

  const handleRegisterAsSource = () => {
    if (!processedEvent) return;
    const vendorName = processedEvent.detection.vendor || 'Unknown Vendor';
    const productName = processedEvent.detection.device_product || 'Perimeter Appliance';

    const newSource: SourceDevice = {
      id: `src-${Date.now().toString(36)}`,
      name: `${productName} (${vendorName})`,
      vendor: vendorName,
      product: productName,
      version: '1.0',
      host: processedEvent.envelope.ingestion_source.ip_address || '10.0.0.1',
      port: 514,
      format: processedEvent.envelope.content_type,
      event_type: processedEvent.detection.event_family || 'traffic',
      status: 'active',
      last_event_at: new Date().toISOString(),
      event_count: 1,
      error_count: 0,
      sample_raw: onboardRaw,
    };

    setSources((prev) => [newSource, ...prev]);
    setHasRegistered(true);
    setTimeout(() => {
      setActiveTab('sources');
      setHasRegistered(false);
    }, 1200);
  };

  const handleToggleStatus = (id: string) => {
    setSources((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, status: s.status === 'active' ? 'inactive' : 'active' } : s
      )
    );
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const filteredSources = sources.filter((s) => {
    const matchQuery =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.vendor.toLowerCase().includes(search.toLowerCase()) ||
      s.product.toLowerCase().includes(search.toLowerCase()) ||
      s.host.includes(search);
    const matchStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchQuery && matchStatus;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100 font-sans">
            Sources & Onboarding
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            ULPF Section 17 & 18: Connect perimeter devices, test raw log samples, and auto-generate semantic mappings.
          </p>
        </div>

        {/* Top Controls */}
        <div className="flex items-center gap-2">
          {onOpenVerification && (
            <Button variant="outline" size="sm" onClick={onOpenVerification} className="text-xs">
              <ShieldCheck className="mr-1.5 h-3.5 w-3.5 text-emerald-400" />
              Run Self-Test
            </Button>
          )}

          {/* Sub-Tab Navigation */}
          <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1 text-xs font-mono">
            <button
              onClick={() => setActiveTab('sources')}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'sources'
                  ? 'bg-zinc-800 text-zinc-100 font-semibold shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Server className="h-3.5 w-3.5 text-emerald-400" />
              <span>Active Sources ({sources.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('onboard')}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'onboard'
                  ? 'bg-zinc-800 text-zinc-100 font-semibold shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Plus className="h-3.5 w-3.5 text-emerald-400" />
              <span>Onboard & Test Log</span>
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'sources' ? (
        /* View 1: Connected Sources Table */
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
              <Input
                placeholder="Filter sources by name, vendor, or IP..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-xs text-zinc-200 font-mono"
            >
              <option value="all">All States</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>

          {/* Sources Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source Appliance</TableHead>
                    <TableHead>Vendor & Product</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Ingress Endpoint</TableHead>
                    <TableHead>Format</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSources.map((src) => (
                    <TableRow key={src.id} className="hover:bg-zinc-800/40">
                      <TableCell className="font-medium text-zinc-200 font-sans">
                        <div className="flex items-center gap-2">
                          <Server className="h-4 w-4 text-emerald-400 shrink-0" />
                          <div>
                            <span className="text-xs font-semibold block">{src.name}</span>
                            <span className="text-[10px] text-zinc-500 font-mono">{src.id}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-zinc-300 font-medium block">{src.vendor}</span>
                        <span className="text-[11px] text-zinc-500 font-mono">{src.product}</span>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-zinc-400">
                        {src.version}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-zinc-300">
                        {src.host}:{src.port}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] font-mono uppercase">
                          {src.format.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={src.status === 'active' ? 'success' : 'secondary'}
                          className="text-[10px]"
                        >
                          {src.status.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => setSelectedSourceForDetail(src)}
                          >
                            Details
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => handleToggleStatus(src.id)}
                          >
                            {src.status === 'active' ? (
                              <Pause className="h-3 w-3 text-amber-400" />
                            ) : (
                              <Play className="h-3 w-3 text-emerald-400" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      ) : (
        /* View 2: Interactive Onboarding & Log Tester (ULPF Section 64) */
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Input & Detection Panel */}
            <div className="lg:col-span-6 space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                      <Terminal className="h-4 w-4 text-emerald-400" />
                      <span>1. Provide Log Sample</span>
                    </CardTitle>
                    <span className="text-[11px] text-zinc-400 font-mono">Syslog, CEF, LEEF, JSON, KV</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Quick Golden Samples */}
                  <div>
                    <label className="text-[10px] font-mono uppercase font-semibold text-zinc-400 mb-1.5 block">
                      Load Representative Perimeter Sample:
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { name: 'Palo Alto (Syslog)', idx: 0 },
                        { name: 'Cisco ASA (Syslog)', idx: 1 },
                        { name: 'FortiGate (Key-Value)', idx: 6 },
                        { name: 'Check Point (LEEF)', idx: 3 },
                        { name: 'Snort 3 (CEF)', idx: 4 },
                        { name: 'Cloud VPC (JSON)', idx: 5 },
                      ].map((chip) => (
                        <button
                          key={chip.name}
                          type="button"
                          onClick={() => handleSelectFixture(chip.idx)}
                          className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 text-[11px] font-mono text-zinc-300 hover:border-emerald-500/50 hover:text-emerald-400 transition-colors cursor-pointer"
                        >
                          {chip.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <Textarea
                    rows={6}
                    value={onboardRaw}
                    onChange={(e) => handleProcessOnboard(e.target.value)}
                    placeholder="Paste any perimeter firewall, router, or gateway log line here..."
                    className="font-mono text-xs text-zinc-200 bg-zinc-950 border-zinc-800 leading-relaxed"
                  />

                  {/* Auto-Detection Summary Banner */}
                  {processedEvent && (
                    <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-emerald-500/30 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono font-semibold text-emerald-400 flex items-center gap-1.5">
                          <Sparkles className="h-3.5 w-3.5" />
                          Simplifyr Auto-Detection (Confidence: {((processedEvent.detection.vendor_confidence || 0.95) * 100).toFixed(0)}%)
                        </span>
                        <Badge variant="success" className="text-[9px] font-mono uppercase">
                          {processedEvent.envelope.content_type}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-xs font-mono pt-1">
                        <div>
                          <span className="text-[10px] text-zinc-500 block">VENDOR</span>
                          <span className="text-zinc-200 font-semibold">{processedEvent.detection.vendor}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-zinc-500 block">PRODUCT</span>
                          <span className="text-zinc-200 font-semibold">{processedEvent.detection.device_product}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-zinc-500 block">FAMILY</span>
                          <span className="text-zinc-200 font-semibold">{processedEvent.detection.event_family}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleProcessOnboard('')}
                      className="text-xs"
                    >
                      Clear
                    </Button>
                    <Button
                      variant="emerald"
                      size="sm"
                      disabled={!processedEvent || hasRegistered}
                      onClick={handleRegisterAsSource}
                      className="text-xs flex items-center gap-1.5"
                    >
                      {hasRegistered ? (
                        <>
                          <CheckCircle className="h-3.5 w-3.5 text-emerald-200" />
                          Registered!
                        </>
                      ) : (
                        <>
                          <Zap className="h-3.5 w-3.5" />
                          Approve & Register Source
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right: Live Conversion Inspector */}
            <div className="lg:col-span-6 space-y-4">
              <Card className="h-full flex flex-col">
                <CardHeader className="pb-3 border-b border-zinc-800 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-semibold text-zinc-200">
                    2. Transformation Verification
                  </CardTitle>
                  <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-md p-0.5 text-[11px] font-mono">
                    {(['output', 'normalized', 'parsed', 'raw'] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setInspectView(mode)}
                        className={`px-2 py-0.5 rounded capitalize transition-colors cursor-pointer ${
                          inspectView === mode
                            ? 'bg-zinc-800 text-emerald-400 font-semibold'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </CardHeader>
                <CardContent className="p-0 flex-1 bg-zinc-950 overflow-hidden">
                  <div className="p-4">
                    {processedEvent ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs font-mono text-zinc-400 pb-2 border-b border-zinc-900">
                          <span className="flex items-center gap-1.5 text-emerald-400">
                            <Lock className="h-3.5 w-3.5" />
                            SHA-256: {processedEvent.envelope.sha256_hash.slice(0, 16)}...
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-[10px]"
                            onClick={() => {
                              const content =
                                inspectView === 'raw'
                                  ? processedEvent.envelope.raw_payload
                                  : JSON.stringify(
                                      inspectView === 'parsed'
                                        ? processedEvent.parsed
                                        : inspectView === 'normalized'
                                        ? processedEvent.canonical
                                        : { event: processedEvent.canonical, provenance: processedEvent.provenance },
                                      null,
                                      2
                                    );
                              handleCopy(content, 'inspector');
                            }}
                          >
                            {copiedKey === 'inspector' ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                            Copy
                          </Button>
                        </div>

                        <pre className="font-mono text-xs text-zinc-300 overflow-auto max-h-[380px] leading-relaxed">
                          {inspectView === 'raw'
                            ? processedEvent.envelope.raw_payload
                            : JSON.stringify(
                                inspectView === 'parsed'
                                  ? processedEvent.parsed
                                  : inspectView === 'normalized'
                                  ? processedEvent.canonical
                                  : { event: processedEvent.canonical, provenance: processedEvent.provenance },
                                null,
                                2
                              )}
                        </pre>
                      </div>
                    ) : (
                      <div className="h-64 flex flex-col items-center justify-center text-zinc-500 text-xs font-mono">
                        <Terminal className="h-8 w-8 mb-2 opacity-40" />
                        <span>Paste a log sample on the left to inspect real-time transformation</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* Source Detail Dialog */}
      {selectedSourceForDetail && (
        <Dialog open={!!selectedSourceForDetail} onOpenChange={() => setSelectedSourceForDetail(null)}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <div className="flex items-center justify-between pr-4">
                <DialogTitle>{selectedSourceForDetail.name}</DialogTitle>
                <Badge variant={selectedSourceForDetail.status === 'active' ? 'success' : 'secondary'}>
                  {selectedSourceForDetail.status.toUpperCase()}
                </Badge>
              </div>
              <DialogDescription>
                {selectedSourceForDetail.vendor} • {selectedSourceForDetail.product} ({selectedSourceForDetail.version})
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-zinc-900/60 border border-zinc-800">
                <div>
                  <span className="text-zinc-500 font-mono text-[10px] block">INGESTION HOST</span>
                  <span className="text-zinc-200 font-mono font-medium">{selectedSourceForDetail.host}:{selectedSourceForDetail.port}</span>
                </div>
                <div>
                  <span className="text-zinc-500 font-mono text-[10px] block">PAYLOAD FORMAT</span>
                  <span className="text-zinc-200 font-mono font-medium uppercase">{selectedSourceForDetail.format}</span>
                </div>
                <div>
                  <span className="text-zinc-500 font-mono text-[10px] block">EVENT FAMILY</span>
                  <span className="text-zinc-200 font-mono font-medium">{selectedSourceForDetail.event_type}</span>
                </div>
                <div>
                  <span className="text-zinc-500 font-mono text-[10px] block">REGISTERED AT</span>
                  <span className="text-zinc-200 font-mono font-medium">{formatRelativeTime(selectedSourceForDetail.last_event_at)}</span>
                </div>
              </div>

              {selectedSourceForDetail.sample_raw && (
                <div className="space-y-1.5">
                  <span className="text-zinc-400 font-mono text-[10px] uppercase font-semibold">Representative Raw Payload</span>
                  <pre className="p-3 rounded bg-zinc-950 border border-zinc-800 text-zinc-300 font-mono text-[11px] overflow-x-auto whitespace-pre-wrap">
                    {selectedSourceForDetail.sample_raw}
                  </pre>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (selectedSourceForDetail.sample_raw) {
                    handleProcessOnboard(selectedSourceForDetail.sample_raw);
                    setActiveTab('onboard');
                  }
                  setSelectedSourceForDetail(null);
                }}
              >
                Test in Onboarder
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSelectedSourceForDetail(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
