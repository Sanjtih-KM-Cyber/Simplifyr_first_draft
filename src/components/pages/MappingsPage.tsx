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
import { Plus, Search, Eye, Copy, GitBranch, Check } from 'lucide-react';
import { VersionedMapping } from '../../types.ts';
import { knowledgeRegistry } from '../../services/knowledgeRegistry.ts';
import { getStatusColor } from '../../lib/utils.ts';

export const MappingsPage: React.FC = () => {
  const [mappings, setMappings] = useState<VersionedMapping[]>(knowledgeRegistry.getAllMappings());
  const [search, setSearch] = useState('');
  const [vendorFilter, setVendorFilter] = useState('all');
  const [selectedMapping, setSelectedMapping] = useState<VersionedMapping | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formVendor, setFormVendor] = useState<'palo_alto' | 'cisco_asa' | 'fortinet_fortigate' | 'checkpoint_quantum' | 'snort_ids'>('palo_alto');
  const [formProduct, setFormProduct] = useState('Firewall Next-Gen');
  const [formVersion, setFormVersion] = useState('v1.0');
  const [formFormat, setFormFormat] = useState('syslog_rfc5424');
  const [formEventType, setFormEventType] = useState('traffic');

  const filteredMappings = mappings.filter((m) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      m.mapping_id.toLowerCase().includes(q) ||
      m.product.toLowerCase().includes(q) ||
      m.event_family.toLowerCase().includes(q);
    const matchesVendor = vendorFilter === 'all' || m.vendor === vendorFilter;
    return matchesSearch && matchesVendor;
  });

  const handleCopy = (m: VersionedMapping) => {
    navigator.clipboard.writeText(JSON.stringify(m, null, 2));
    setCopiedId(m.mapping_id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    const newMapping: VersionedMapping = {
      mapping_id: `custom-${formVendor}-${Date.now().toString(36)}`,
      vendor: formVendor,
      product: formProduct,
      software_version: formVersion,
      event_family: formEventType,
      format: formFormat as any,
      rules: [
        { input_field: 'src', semantic_field: 'source.ip', transformation_type: 'identity', confidence: 0.99 },
        { input_field: 'dst', semantic_field: 'destination.ip', transformation_type: 'identity', confidence: 0.99 },
        { input_field: 'spt', semantic_field: 'source.port', transformation_type: 'cast', confidence: 0.99 },
        { input_field: 'dpt', semantic_field: 'destination.port', transformation_type: 'cast', confidence: 0.99 },
        { input_field: 'action', semantic_field: 'network.action', transformation_type: 'enum', confidence: 0.95 },
      ],
      status: 'active',
      created_at: new Date().toISOString(),
      approved_by: 'Current Administrator',
      change_notes: formName,
    };

    knowledgeRegistry.registerMapping(newMapping);
    setMappings(knowledgeRegistry.getAllMappings());
    setIsCreateOpen(false);
    setFormName('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100 font-sans">Field Mappings & Schemas</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Manage vendor-specific field mapping rules, transformations, and ECS/OCSF semantic targets
          </p>
        </div>
        <Button variant="emerald" size="sm" onClick={() => setIsCreateOpen(true)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Create Mapping
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
          <Input
            placeholder="Search mappings by ID, product, family..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <select
          value={vendorFilter}
          onChange={(e) => setVendorFilter(e.target.value)}
          className="h-9 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-xs text-zinc-200 font-mono"
        >
          <option value="all">All Vendors</option>
          <option value="palo_alto">Palo Alto</option>
          <option value="cisco_asa">Cisco ASA</option>
          <option value="fortinet_fortigate">Fortinet</option>
          <option value="checkpoint_quantum">Check Point</option>
          <option value="snort_ids">Snort 3</option>
        </select>
      </div>

      {/* Mappings Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mapping ID</TableHead>
                <TableHead>Vendor / Product</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Format</TableHead>
                <TableHead>Event Family</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Rules Count</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMappings.map((m) => (
                <TableRow key={m.mapping_id} className="hover:bg-zinc-800/40">
                  <TableCell className="font-mono text-xs font-semibold text-zinc-200">
                    <div className="flex items-center gap-2">
                      <GitBranch className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      <span>{m.mapping_id}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium text-zinc-200 capitalize">{m.vendor.replace('_', ' ')}</span>
                    <span className="text-zinc-500 text-[11px] block">{m.product}</span>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-zinc-300">
                    {m.software_version}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] uppercase font-mono">
                      {m.format}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-[10px] font-mono">
                      {m.event_family}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${getStatusColor(m.status)}`}>
                      {m.status.toUpperCase()}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-zinc-200">
                    {m.rules.length} fields
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSelectedMapping(m)}
                        title="Inspect Field Rules"
                      >
                        <Eye className="h-3.5 w-3.5 text-zinc-400" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleCopy(m)}
                        title="Copy Mapping Definition"
                      >
                        {copiedId === m.mapping_id ? (
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="h-3.5 w-3.5 text-zinc-400" />
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

      {/* Detail Dialog */}
      {selectedMapping && (
        <Dialog open={!!selectedMapping} onOpenChange={() => setSelectedMapping(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between pr-6">
                <DialogTitle className="font-mono text-base">{selectedMapping.mapping_id}</DialogTitle>
                <Badge variant="success">{selectedMapping.status.toUpperCase()}</Badge>
              </div>
              <DialogDescription>
                {selectedMapping.product} • Version {selectedMapping.software_version} ({selectedMapping.rules.length} mapped field rules)
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 text-xs">
              <div className="rounded-lg border border-zinc-800 overflow-hidden">
                <table className="w-full text-left font-mono text-xs">
                  <thead className="bg-zinc-900 text-zinc-400 text-[11px] border-b border-zinc-800">
                    <tr>
                      <th className="p-2.5">Input Field</th>
                      <th className="p-2.5">Semantic Field (ECS)</th>
                      <th className="p-2.5">Transformation</th>
                      <th className="p-2.5 text-right">Confidence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900 bg-zinc-950">
                    {selectedMapping.rules.map((rule) => (
                      <tr key={rule.input_field} className="hover:bg-zinc-900/50">
                        <td className="p-2.5 text-amber-300 font-semibold">{rule.input_field}</td>
                        <td className="p-2.5 text-emerald-400 font-semibold">{rule.semantic_field}</td>
                        <td className="p-2.5 text-zinc-400 uppercase text-[10px]">{rule.transformation_type}</td>
                        <td className="p-2.5 text-right text-zinc-300">
                          {Math.round(rule.confidence * 100)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setSelectedMapping(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Field Mapping Rule Set</DialogTitle>
            <DialogDescription>
              Define vendor parsing directives and target canonical semantic structures.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-3 text-xs">
            <div>
              <Label>Mapping Name / Note *</Label>
              <Input
                placeholder="e.g. Palo Alto PAN-OS 11 GlobalProtect VPN Mapping"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Vendor</Label>
                <select
                  value={formVendor}
                  onChange={(e) => setFormVendor(e.target.value as any)}
                  className="w-full h-9 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-xs text-zinc-100 font-mono"
                >
                  <option value="palo_alto">Palo Alto</option>
                  <option value="cisco_asa">Cisco ASA</option>
                  <option value="fortinet_fortigate">Fortinet</option>
                  <option value="checkpoint_quantum">Check Point</option>
                  <option value="snort_ids">Snort 3</option>
                </select>
              </div>
              <div>
                <Label>Product Name</Label>
                <Input value={formProduct} onChange={(e) => setFormProduct(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Software Version</Label>
                <Input value={formVersion} onChange={(e) => setFormVersion(e.target.value)} />
              </div>
              <div>
                <Label>Format</Label>
                <Input value={formFormat} onChange={(e) => setFormFormat(e.target.value)} />
              </div>
              <div>
                <Label>Event Family</Label>
                <Input value={formEventType} onChange={(e) => setFormEventType(e.target.value)} />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="emerald">
                Save & Register
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
