/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Card, CardContent } from '../ui/card.tsx';
import { Button } from '../ui/button.tsx';
import { Input } from '../ui/input.tsx';
import { Badge } from '../ui/badge.tsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table.tsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog.tsx';
import { Label } from '../ui/label.tsx';
import {
  Plus,
  Search,
  Trash2,
  Play,
  Pause,
  ExternalLink,
  Server,
  Settings,
  Shield,
  Activity,
  CheckCircle,
} from 'lucide-react';
import { formatRelativeTime, getStatusColor } from '../../lib/utils.ts';
import { GOLDEN_CORPUS } from '../../data/goldenCorpus.ts';

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

const INITIAL_SOURCES: SourceDevice[] = [
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
    last_event_at: new Date(Date.now() - 4000).toISOString(),
    event_count: 84210,
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
    last_event_at: new Date(Date.now() - 8000).toISOString(),
    event_count: 61920,
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
    last_event_at: new Date(Date.now() - 15000).toISOString(),
    event_count: 42100,
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
    last_event_at: new Date(Date.now() - 25000).toISOString(),
    event_count: 19800,
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
    last_event_at: new Date(Date.now() - 32000).toISOString(),
    event_count: 5310,
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
    last_event_at: new Date(Date.now() - 60000).toISOString(),
    event_count: 31200,
    error_count: 0,
    sample_raw: GOLDEN_CORPUS[5]?.raw,
  },
];

interface SourcesPageProps {
  onTestSampleInWorkbench?: (raw: string) => void;
}

export const SourcesPage: React.FC<SourcesPageProps> = ({ onTestSampleInWorkbench }) => {
  const [sources, setSources] = useState<SourceDevice[]>(INITIAL_SOURCES);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedSourceForDetail, setSelectedSourceForDetail] = useState<SourceDevice | null>(null);

  // Form state
  const [newSourceName, setNewSourceName] = useState('');
  const [newSourceVendor, setNewSourceVendor] = useState('Palo Alto Networks');
  const [newSourceProduct, setNewSourceProduct] = useState('PA-3400 Series');
  const [newSourceHost, setNewSourceHost] = useState('192.168.10.1');
  const [newSourcePort, setNewSourcePort] = useState(514);
  const [newSourceFormat, setNewSourceFormat] = useState('syslog_rfc5424');

  const filteredSources = sources.filter((s) => {
    const matchQuery =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.vendor.toLowerCase().includes(search.toLowerCase()) ||
      s.product.toLowerCase().includes(search.toLowerCase()) ||
      s.host.includes(search);
    const matchStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchQuery && matchStatus;
  });

  const handleToggleStatus = (id: string) => {
    setSources((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, status: s.status === 'active' ? 'inactive' : 'active' } : s
      )
    );
  };

  const handleDeleteSource = (id: string) => {
    setSources((prev) => prev.filter((s) => s.id !== id));
  };

  const handleCreateSource = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSourceName.trim()) return;

    const newSource: SourceDevice = {
      id: `src-${Date.now().toString(36)}`,
      name: newSourceName.trim(),
      vendor: newSourceVendor,
      product: newSourceProduct,
      version: 'v1.0',
      host: newSourceHost,
      port: Number(newSourcePort) || 514,
      format: newSourceFormat,
      event_type: 'traffic',
      status: 'active',
      last_event_at: new Date().toISOString(),
      event_count: 0,
      error_count: 0,
      sample_raw: GOLDEN_CORPUS[0]?.raw,
    };

    setSources((prev) => [newSource, ...prev]);
    setIsAddModalOpen(false);
    setNewSourceName('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100 font-sans">Sources</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Manage perimeter log sources, ingestion transports, and device connection status
          </p>
        </div>
        <Button variant="emerald" size="sm" onClick={() => setIsAddModalOpen(true)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add Source
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
          <Input
            placeholder="Search sources by name, vendor, IP..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-lg p-1 text-xs font-mono">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
              statusFilter === 'all' ? 'bg-zinc-800 text-zinc-100 font-semibold' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            All Statuses
          </button>
          <button
            onClick={() => setStatusFilter('active')}
            className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
              statusFilter === 'active' ? 'bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setStatusFilter('inactive')}
            className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
              statusFilter === 'inactive' ? 'bg-zinc-800 text-zinc-300 font-semibold' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Inactive
          </button>
        </div>
      </div>

      {/* Sources Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source Name</TableHead>
                <TableHead>Vendor / Product</TableHead>
                <TableHead>Format</TableHead>
                <TableHead>Event Type</TableHead>
                <TableHead className="text-right">Events</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Telemetry</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSources.map((source) => (
                <TableRow key={source.id}>
                  <TableCell className="font-medium text-zinc-100">
                    <div className="flex items-center gap-2">
                      <Server className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                      <span>{source.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-zinc-300">
                      <span className="font-medium">{source.vendor}</span>
                      <span className="text-zinc-500 text-[11px] block">{source.product} ({source.version})</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-[10px] uppercase">
                      {source.format}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-[10px] font-mono">
                      {source.event_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-zinc-200">
                    {source.event_count.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${getStatusColor(source.status)}`}>
                      {source.status.toUpperCase()}
                    </span>
                  </TableCell>
                  <TableCell className="text-zinc-400 font-mono text-[11px]">
                    {formatRelativeTime(source.last_event_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleToggleStatus(source.id)}
                        title={source.status === 'active' ? 'Pause Source' : 'Resume Source'}
                      >
                        {source.status === 'active' ? (
                          <Pause className="h-3.5 w-3.5 text-amber-400" />
                        ) : (
                          <Play className="h-3.5 w-3.5 text-emerald-400" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSelectedSourceForDetail(source)}
                        title="View Source Details"
                      >
                        <ExternalLink className="h-3.5 w-3.5 text-zinc-400" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteSource(source.id)}
                        title="Delete Source"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="p-3 border-t border-zinc-800/80 text-xs text-zinc-500 flex items-center justify-between">
            <span>Showing {filteredSources.length} configured perimeter sources</span>
            <span className="font-mono text-[11px] text-emerald-400">All transports operational</span>
          </div>
        </CardContent>
      </Card>

      {/* Add Source Dialog */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Perimeter Source</DialogTitle>
            <DialogDescription>
              Register a firewall, NIDS sensor, or cloud gateway to receive telemetry.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateSource} className="space-y-3 text-xs">
            <div>
              <Label>Source Friendly Name *</Label>
              <Input
                placeholder="e.g. DMZ Firewall 02"
                value={newSourceName}
                onChange={(e) => setNewSourceName(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Vendor</Label>
                <Input
                  value={newSourceVendor}
                  onChange={(e) => setNewSourceVendor(e.target.value)}
                />
              </div>
              <div>
                <Label>Product Model</Label>
                <Input
                  value={newSourceProduct}
                  onChange={(e) => setNewSourceProduct(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Host / IP Address</Label>
                <Input
                  value={newSourceHost}
                  onChange={(e) => setNewSourceHost(e.target.value)}
                />
              </div>
              <div>
                <Label>Port</Label>
                <Input
                  type="number"
                  value={newSourcePort}
                  onChange={(e) => setNewSourcePort(Number(e.target.value))}
                />
              </div>
            </div>

            <div>
              <Label>Telemetry Format</Label>
              <select
                value={newSourceFormat}
                onChange={(e) => setNewSourceFormat(e.target.value)}
                className="w-full h-9 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-xs text-zinc-100 font-mono"
              >
                <option value="syslog_rfc5424">Syslog (RFC 5424 / PAN-OS)</option>
                <option value="syslog_rfc3164">Syslog (RFC 3164 / Cisco ASA)</option>
                <option value="cef">CEF (Common Event Format)</option>
                <option value="leef">LEEF (Log Event Extended Format)</option>
                <option value="keyvalue">Key-Value Pairs (FortiOS)</option>
                <option value="json">Structured JSON (Cloud VPC)</option>
              </select>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="emerald">
                Register Source
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Source Detail Drawer/Dialog */}
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
                  <span className="text-zinc-500 font-mono text-[10px] block">TOTAL EVENTS</span>
                  <span className="text-zinc-200 font-mono font-medium">{selectedSourceForDetail.event_count.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-zinc-500 font-mono text-[10px] block">LAST TELEMETRY</span>
                  <span className="text-emerald-400 font-mono font-medium">{formatRelativeTime(selectedSourceForDetail.last_event_at)}</span>
                </div>
              </div>

              {selectedSourceForDetail.sample_raw && (
                <div>
                  <div className="text-[11px] font-mono text-zinc-400 mb-1.5 flex items-center justify-between">
                    <span>SAMPLE PAYLOAD FIXTURE</span>
                    {onTestSampleInWorkbench && (
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-[11px]"
                        onClick={() => {
                          if (selectedSourceForDetail.sample_raw) {
                            onTestSampleInWorkbench(selectedSourceForDetail.sample_raw);
                            setSelectedSourceForDetail(null);
                          }
                        }}
                      >
                        Inspect in Workbench →
                      </Button>
                    )}
                  </div>
                  <pre className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-[11px] text-zinc-300 overflow-x-auto whitespace-pre-wrap max-h-36">
                    {selectedSourceForDetail.sample_raw}
                  </pre>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedSourceForDetail(null)}
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
