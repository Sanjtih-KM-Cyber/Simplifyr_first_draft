/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card.tsx';
import { Button } from '../ui/button.tsx';
import { Badge } from '../ui/badge.tsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table.tsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog.tsx';
import {
  RefreshCw,
  Check,
  X,
  Eye,
  AlertTriangle,
  Sparkles,
  Bot,
  ShieldAlert,
  ArrowRight,
  RotateCcw,
  CheckCircle,
  HelpCircle,
  ArrowUpRight,
} from 'lucide-react';
import { QuarantinedEvent, ReprocessResult, SuggestedRulePatch } from '../../types.ts';
import { quarantineManager } from '../../services/quarantineManager.ts';
import { driftEngine } from '../../services/driftEngine.ts';
import { processRawEventThroughPipeline } from '../../services/streamSimulator.ts';
import { GOLDEN_CORPUS } from '../../data/goldenCorpus.ts';

interface DriftPageProps {
  onNavigateToWorkbench?: (raw: string) => void;
}

export const DriftPage: React.FC<DriftPageProps> = ({ onNavigateToWorkbench }) => {
  const [quarantinedEvents, setQuarantinedEvents] = useState<QuarantinedEvent[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedDrift, setSelectedDrift] = useState<QuarantinedEvent | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [reprocessResult, setReprocessResult] = useState<ReprocessResult | null>(null);
  const [isNewVendorAnswer, setIsNewVendorAnswer] = useState<boolean | null>(null);
  const [isSchemaUpdateAnswer, setIsSchemaUpdateAnswer] = useState<boolean | null>(null);

  const loadEvents = () => {
    setQuarantinedEvents(quarantineManager.getAll());
  };

  useEffect(() => {
    loadEvents();
    const unsubscribe = quarantineManager.subscribe((list) => {
      setQuarantinedEvents(list);
    });
    return () => unsubscribe();
  }, []);

  const filteredDrifts = quarantinedEvents.filter((d) => {
    if (statusFilter === 'all') return true;
    return d.status.toLowerCase() === statusFilter.toLowerCase();
  });

  const handleOpenDriftDetail = (drift: QuarantinedEvent) => {
    setSelectedDrift(drift);
    setIsNewVendorAnswer(null);
    setIsSchemaUpdateAnswer(null);
  };

  const handleInjectSampleDrift = () => {
    // Ingest the PAN JA4 sample from golden corpus to trigger real drift
    const sample = GOLDEN_CORPUS[7];
    if (sample) {
      processRawEventThroughPipeline(sample.raw, { isDrift: true, driftReason: 'TLS JA4 fingerprint and cloud VPC tags' });
      loadEvents();
    }
  };

  const handleApprove = async (item: QuarantinedEvent) => {
    try {
      let patches: SuggestedRulePatch[] = [];
      let version = 'v1.1';

      if (item.aiAnalysis) {
        patches = item.aiAnalysis.suggestedRulePatches;
        version = item.aiAnalysis.proposedVersion;
      } else {
        setIsAnalyzing(true);
        const analysis = await driftEngine.analyzeDriftWithAI(item.event, item.diffResult);
        quarantineManager.attachAiAnalysis(item.id, analysis);
        patches = analysis.suggestedRulePatches;
        version = analysis.proposedVersion;
        setIsAnalyzing(false);
      }

      const res = quarantineManager.reprocess(
        item.id,
        patches,
        version,
        'SecOps Operator',
        'Auto-approved via Section 29 Human-in-the-Loop UX'
      );
      if (res) setReprocessResult(res);
      loadEvents();
    } catch (err) {
      console.error('Approve/reprocess error:', err);
      setIsAnalyzing(false);
    }
  };

  const handleReject = (item: QuarantinedEvent) => {
    quarantineManager.discard(item.id);
    loadEvents();
    if (selectedDrift?.id === item.id) setSelectedDrift(null);
  };

  const handleRunAiAnalysis = async (item: QuarantinedEvent) => {
    setIsAnalyzing(true);
    try {
      const analysis = await driftEngine.analyzeDriftWithAI(item.event, item.diffResult);
      quarantineManager.attachAiAnalysis(item.id, analysis);
      const updated = quarantineManager.getById(item.id);
      if (updated) setSelectedDrift(updated);
      loadEvents();
    } catch (err) {
      console.error('AI Analysis failed:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100 font-sans">Drift Detection & Quarantine</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Zero-day schema drift isolation, Human-in-the-Loop triage (ULPF Sections 28–31), and versioned schema updates
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleInjectSampleDrift}>
            <AlertTriangle className="mr-1.5 h-3.5 w-3.5 text-amber-400" />
            Ingest Drift Sample
          </Button>
          <Button variant="outline" size="sm" onClick={loadEvents}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-lg p-1 text-xs font-mono w-fit">
        {['all', 'quarantined', 'patch_ready', 'reprocessed', 'discarded'].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-3 py-1 rounded-md transition-colors capitalize cursor-pointer ${
              statusFilter === status
                ? 'bg-zinc-800 text-zinc-100 font-semibold shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {status} ({quarantinedEvents.filter((e) => status === 'all' || e.status.toLowerCase() === status.toLowerCase()).length})
          </button>
        ))}
      </div>

      {/* Quarantined Events Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-400" />
              <span>Quarantine Registry</span>
            </div>
            <span className="text-xs font-mono text-zinc-500 font-normal">
              {filteredDrifts.length} quarantined event{filteredDrifts.length === 1 ? '' : 's'}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[110px]">Event ID</TableHead>
                <TableHead>Vendor & Device</TableHead>
                <TableHead>Format</TableHead>
                <TableHead>Drift Tokens</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDrifts.map((drift) => {
                const unmappedTokens = drift.diffResult.tokens
                  .filter((t) => t.status === 'NOVEL_UNMAPPED')
                  .map((t) => t.token);

                return (
                  <TableRow key={drift.id} className="font-mono text-xs">
                    <TableCell className="text-zinc-400 font-mono text-[11px]">
                      {drift.id.substring(0, 8)}...
                    </TableCell>
                    <TableCell className="font-sans font-medium text-zinc-200">
                      <div>{drift.event.detection.device_product}</div>
                      <div className="text-[10px] text-zinc-500 font-mono">{drift.event.detection.vendor}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {drift.event.detection.format}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {unmappedTokens.slice(0, 3).map((tok) => (
                          <span
                            key={tok}
                            className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[10px]"
                          >
                            +{tok}
                          </span>
                        ))}
                        {unmappedTokens.length > 3 && (
                          <span className="text-[10px] text-zinc-500">+{unmappedTokens.length - 3} more</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          drift.status === 'REPROCESSED'
                            ? 'success'
                            : drift.status === 'PATCH_READY'
                            ? 'secondary'
                            : 'warning'
                        }
                        className="text-[10px]"
                      >
                        {drift.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-amber-400 text-[11px]">
                        {drift.diffResult.driftSeverity}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5 font-sans">
                        {drift.status === 'QUARANTINED' && (
                          <>
                            <Button
                              variant="emerald"
                              size="sm"
                              onClick={() => handleOpenDriftDetail(drift)}
                              className="h-7 text-[11px] px-2"
                              title="Triage Drift with Human-in-the-Loop workflow"
                            >
                              <Bot className="h-3 w-3 mr-1" />
                              Triage
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-zinc-500 hover:text-red-400"
                              onClick={() => handleReject(drift)}
                              title="Discard"
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}

                        {drift.status === 'REPROCESSED' && (
                          <Badge variant="success" className="text-[10px]">REPROCESSED</Badge>
                        )}

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-zinc-400 hover:text-zinc-200"
                          onClick={() => handleOpenDriftDetail(drift)}
                          title="Inspect Drift Diff & Schema Versioning"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}

              {filteredDrifts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-zinc-500 text-xs">
                    <div className="max-w-sm mx-auto space-y-3">
                      <CheckCircle className="h-8 w-8 text-emerald-500/60 mx-auto" />
                      <div className="font-sans font-medium text-zinc-300">All Perimeter Schemas Stable</div>
                      <p className="text-[11px] text-zinc-500 font-sans">
                        Zero unmapped fields or schema drift detected across active feeds. Ingest an event with novel telemetry to observe autonomous drift isolation and Human-in-the-Loop resolution.
                      </p>
                      <Button variant="outline" size="sm" onClick={handleInjectSampleDrift} className="text-xs">
                        <AlertTriangle className="h-3.5 w-3.5 mr-1.5 text-amber-400" />
                        Ingest Sample Drift Log
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Section 28 & 29: Drift Detection & Human-in-the-Loop Triage Modal */}
      {selectedDrift && (
        <Dialog open={!!selectedDrift} onOpenChange={() => setSelectedDrift(null)}>
          <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between pr-6">
                <DialogTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                  <span>Drift Triage & Schema Update</span>
                </DialogTitle>
                <Badge variant="warning">{selectedDrift.status}</Badge>
              </div>
              <DialogDescription>
                {selectedDrift.event.detection.device_product} • {selectedDrift.event.detection.vendor}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 text-xs">
              {/* Section 28: UX Banner */}
              <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-400 font-bold font-mono text-sm">
                    <AlertTriangle className="h-4 w-4" />
                    <span>⚠ POSSIBLE SCHEMA CHANGE</span>
                  </div>
                  <Badge variant="outline" className="border-amber-500/40 text-amber-300 font-mono text-[10px]">
                    Confidence: 96%
                  </Badge>
                </div>
                <div className="text-zinc-300 text-xs">
                  <strong>Device:</strong> {selectedDrift.event.detection.device_product}
                </div>
                <div className="text-zinc-400 text-xs">
                  <strong>Likely cause:</strong> Software / schema update from vendor perimeter telemetry.
                </div>
              </div>

              {/* Section 28: Side-by-Side Old vs New Schema Comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Previous Known Schema */}
                <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-1.5">
                    <span className="font-semibold text-zinc-300 font-sans">Previous Known Schema</span>
                    <Badge variant="outline" className="text-[10px] font-mono">v1.0</Badge>
                  </div>
                  <div className="space-y-1 font-mono text-[11px] text-zinc-400">
                    {selectedDrift.event.mapping?.rules.slice(0, 5).map((r) => (
                      <div key={r.input_field} className="flex justify-between">
                        <span className="text-zinc-300">{r.input_field}</span>
                        <span className="text-zinc-600">→ {r.semantic_field}</span>
                      </div>
                    )) || (
                      <>
                        <div className="text-zinc-300">srcip</div>
                        <div className="text-zinc-300">dstip</div>
                        <div className="text-zinc-300">action</div>
                      </>
                    )}
                  </div>
                </div>

                {/* Current Ingested Schema */}
                <div className="p-3 rounded-lg bg-zinc-900 border border-amber-500/40 space-y-2">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-1.5">
                    <span className="font-semibold text-amber-300 font-sans">Current Ingested Schema</span>
                    <Badge variant="warning" className="text-[10px] font-mono">Drift Detected</Badge>
                  </div>
                  <div className="space-y-1 font-mono text-[11px]">
                    {selectedDrift.diffResult.tokens.map((tok) => (
                      <div
                        key={tok.token}
                        className={`flex justify-between ${
                          tok.status === 'NOVEL_UNMAPPED'
                            ? 'text-amber-300 font-semibold'
                            : 'text-zinc-400'
                        }`}
                      >
                        <span>{tok.token}</span>
                        <span className="text-[10px]">
                          {tok.status === 'NOVEL_UNMAPPED' ? '(NOVEL)' : '(matched)'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Section 29: Human-in-the-Loop Triage Questions */}
              <div className="p-4 rounded-lg bg-zinc-900/90 border border-zinc-800 space-y-3">
                <div className="flex items-center gap-2 font-semibold text-zinc-200 font-sans">
                  <HelpCircle className="h-4 w-4 text-blue-400" />
                  <span>Human-in-the-Loop Triage (ULPF Section 29)</span>
                </div>

                {/* Question 1 */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded bg-zinc-950 border border-zinc-800/80">
                  <span className="text-zinc-300">Is this a new vendor?</span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant={isNewVendorAnswer === true ? 'emerald' : 'outline'}
                      size="sm"
                      className="h-7 px-3 text-xs"
                      onClick={() => {
                        setIsNewVendorAnswer(true);
                        setIsSchemaUpdateAnswer(null);
                      }}
                    >
                      YES
                    </Button>
                    <Button
                      variant={isNewVendorAnswer === false ? 'secondary' : 'outline'}
                      size="sm"
                      className="h-7 px-3 text-xs"
                      onClick={() => {
                        setIsNewVendorAnswer(false);
                      }}
                    >
                      NO
                    </Button>
                  </div>
                </div>

                {/* If New Vendor: Workflow A */}
                {isNewVendorAnswer === true && (
                  <div className="p-3 rounded bg-blue-500/10 border border-blue-500/30 text-blue-200 space-y-2">
                    <p className="text-xs">
                      <strong>Workflow A:</strong> This event represents an un-onboarded vendor perimeter device. Send to Normalizer Workbench to configure initial detection rules and schema.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-blue-500/40 text-blue-300 hover:bg-blue-500/20"
                      onClick={() => {
                        if (onNavigateToWorkbench) {
                          onNavigateToWorkbench(selectedDrift.event.raw);
                        }
                        setSelectedDrift(null);
                      }}
                    >
                      <span>Open in Normalizer Workbench</span>
                      <ArrowUpRight className="h-3.5 w-3.5 ml-1.5" />
                    </Button>
                  </div>
                )}

                {/* Question 2 (only if not new vendor) */}
                {isNewVendorAnswer === false && (
                  <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded bg-zinc-950 border border-zinc-800/80">
                    <span className="text-zinc-300">Is this a software / schema update?</span>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant={isSchemaUpdateAnswer === true ? 'emerald' : 'outline'}
                        size="sm"
                        className="h-7 px-3 text-xs"
                        onClick={() => {
                          setIsSchemaUpdateAnswer(true);
                          if (!selectedDrift.aiAnalysis) {
                            handleRunAiAnalysis(selectedDrift);
                          }
                        }}
                      >
                        YES
                      </Button>
                      <Button
                        variant={isSchemaUpdateAnswer === false ? 'destructive' : 'outline'}
                        size="sm"
                        className="h-7 px-3 text-xs"
                        onClick={() => {
                          setIsSchemaUpdateAnswer(false);
                        }}
                      >
                        NO
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Raw Payload Preview */}
              <div>
                <span className="text-zinc-400 font-mono text-[11px] block mb-1">RAW ISOLATED PAYLOAD</span>
                <pre className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-[11px] text-zinc-300 whitespace-pre-wrap break-all max-h-24 overflow-y-auto">
                  {selectedDrift.event.raw}
                </pre>
              </div>

              {/* Workflow B: AI Proposal and Approval */}
              {isSchemaUpdateAnswer === true && (
                <div className="p-4 rounded-lg bg-emerald-950/20 border border-emerald-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4" />
                      Section 29 Schema Update Proposal
                    </span>
                    <Badge variant="success" className="text-[10px]">
                      Proposed: {selectedDrift.aiAnalysis?.proposedVersion || 'v1.1'}
                    </Badge>
                  </div>

                  <p className="text-zinc-300 text-xs leading-relaxed">
                    {selectedDrift.aiAnalysis?.rootCauseAnalysis ||
                      'Analyzing structural differences and proposing semantic mapping updates to retain 100% telemetry continuity...'}
                  </p>

                  {selectedDrift.aiAnalysis?.suggestedRulePatches && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[11px] font-mono text-zinc-400 block">PROPOSED FIELD MAPPINGS:</span>
                      {selectedDrift.aiAnalysis.suggestedRulePatches.map((patch) => (
                        <div
                          key={patch.input_field}
                          className="flex items-center justify-between p-2 rounded bg-zinc-900 border border-zinc-800 font-mono text-[11px]"
                        >
                          <div>
                            <span className="text-amber-400 font-semibold">{patch.input_field}</span>
                            <span className="text-zinc-500 mx-2">→</span>
                            <span className="text-emerald-400 font-semibold">{patch.semantic_field}</span>
                            <span className="text-zinc-500 text-[10px] ml-2">({patch.transformation_type})</span>
                          </div>
                          <Badge variant="outline" className="text-[10px]">
                            {Math.round(patch.confidence * 100)}% Confidence
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="text-[11px] text-zinc-400 bg-zinc-900/60 p-2.5 rounded border border-zinc-800">
                    <strong>ULPF Section 32 Knowledge Versioning:</strong> Approving creates version {selectedDrift.aiAnalysis?.proposedVersion || 'v1.1'}, updates the Knowledge Registry, reprocesses the quarantined log, and preserves previous mappings for historical backward compatibility.
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setSelectedDrift(null)}>
                Cancel
              </Button>
              {selectedDrift.status !== 'REPROCESSED' && (
                <Button
                  variant="emerald"
                  size="sm"
                  onClick={() => {
                    handleApprove(selectedDrift);
                    setSelectedDrift(null);
                  }}
                  disabled={isAnalyzing}
                >
                  <Check className="h-3.5 w-3.5 mr-1.5" />
                  Approve New Version ({selectedDrift.aiAnalysis?.proposedVersion || 'v1.1'})
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
