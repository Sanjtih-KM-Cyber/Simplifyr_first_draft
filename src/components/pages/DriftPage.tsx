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
} from 'lucide-react';
import { QuarantinedEvent, ReprocessResult, SuggestedRulePatch } from '../../types.ts';
import { quarantineManager } from '../../services/quarantineManager.ts';
import { driftEngine } from '../../services/driftEngine.ts';
import { formatRelativeTime, getStatusColor } from '../../lib/utils.ts';

interface DriftPageProps {
  onInspectInDock?: (item: QuarantinedEvent) => void;
}

export const DriftPage: React.FC<DriftPageProps> = ({ onInspectInDock }) => {
  const [quarantinedEvents, setQuarantinedEvents] = useState<QuarantinedEvent[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedDrift, setSelectedDrift] = useState<QuarantinedEvent | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [reprocessResult, setReprocessResult] = useState<ReprocessResult | null>(null);

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
        'Auto-approved via Drift Management console'
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
            Zero-day schema drift isolation, Gemini AI telemetry analysis, and autonomous mapping hot-patches
          </p>
        </div>
        <div className="flex items-center gap-2">
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
            {status.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Reprocess Alert Notice */}
      {reprocessResult && (
        <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-950/20 text-xs flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2 text-emerald-400 font-medium">
            <CheckCircle className="h-4 w-4 shrink-0" />
            <span>
              {reprocessResult.message}: Patch {reprocessResult.appliedVersion} deployed! Unmapped fields reduced from {reprocessResult.previousUnmappedCount} to {reprocessResult.newUnmappedCount}.
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setReprocessResult(null)} className="text-emerald-400">
            Dismiss
          </Button>
        </div>
      )}

      {/* Drift Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source Device</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Detected Issue</TableHead>
                <TableHead>Novel Tokens</TableHead>
                <TableHead>AI Confidence</TableHead>
                <TableHead>Quarantined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDrifts.map((drift, idx) => {
                const novelCount = drift.diffResult.novelCount;
                const aiConfidence = drift.aiAnalysis?.suggestedRulePatches?.[0]?.confidence ?? 0.94;

                return (
                  <TableRow key={`${drift.id}-${idx}`} className="hover:bg-zinc-800/40">
                    <TableCell className="font-medium text-zinc-100 font-mono text-xs">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                        <div>
                          <span className="capitalize">{drift.event.detection.vendor.replace('_', ' ')}</span>
                          <span className="text-zinc-500 text-[11px] block">{drift.fingerprint.version}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${getStatusColor(drift.status)}`}>
                        {drift.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-zinc-300 text-xs max-w-[260px] truncate">
                      {drift.quarantineReason}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {novelCount} novel field{novelCount !== 1 ? 's' : ''}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {drift.aiAnalysis ? (
                        <Badge variant="success" className="text-[10px] font-mono">
                          {Math.round(aiConfidence * 100)}% AI Confidence
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px] font-mono text-zinc-400">
                          Pending AI Run
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-zinc-400 text-[11px]">
                      {formatRelativeTime(drift.quarantinedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {drift.status !== 'REPROCESSED' && drift.status !== 'DISCARDED' && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleApprove(drift)}
                              title="Approve patch and reprocess quarantined event"
                              className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/40"
                              disabled={isAnalyzing}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleReject(drift)}
                              title="Reject / Discard from quarantine"
                              className="text-rose-400 hover:text-rose-300 hover:bg-rose-950/40"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        )}

                        {drift.status === 'REPROCESSED' && (
                          <Badge variant="success" className="text-[10px]">REPROCESSED</Badge>
                        )}

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (onInspectInDock) {
                              onInspectInDock(drift);
                            } else {
                              setSelectedDrift(drift);
                            }
                          }}
                          title="Inspect Drift Diff & AI Patch"
                        >
                          <Eye className="h-4 w-4 text-zinc-400" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}

              {filteredDrifts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-zinc-500 text-xs">
                    No schema drift records currently in quarantine for status: {statusFilter}.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Drift Detail / AI Root Cause Analysis Modal */}
      {selectedDrift && (
        <Dialog open={!!selectedDrift} onOpenChange={() => setSelectedDrift(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between pr-6">
                <DialogTitle className="flex items-center gap-2 text-base">
                  <Bot className="h-4 w-4 text-emerald-400" />
                  <span>Schema Drift Analysis & Remediation</span>
                </DialogTitle>
                <Badge variant="warning">{selectedDrift.status}</Badge>
              </div>
              <DialogDescription>
                {selectedDrift.event.detection.vendor} • Version {selectedDrift.fingerprint.version}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 text-xs">
              {/* Diff Summary */}
              <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-200">Structural Diff Breakdown</span>
                  <span className="font-mono text-amber-400 text-[11px]">
                    Drift Severity: {selectedDrift.diffResult.driftSeverity} ({Math.round(selectedDrift.diffResult.driftScore * 100)}%)
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {selectedDrift.diffResult.tokens.map((tok) => {
                    if (tok.status === 'NOVEL_UNMAPPED') {
                      return (
                        <span
                          key={tok.token}
                          className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono text-[11px]"
                        >
                          + {tok.token}
                        </span>
                      );
                    }
                    return null;
                  })}
                </div>
              </div>

              {/* Raw Sample Event */}
              <div>
                <span className="text-zinc-400 font-mono text-[11px] block mb-1">RAW UNMAPPED LOG PAYLOAD</span>
                <pre className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-[11px] text-zinc-300 whitespace-pre-wrap break-all max-h-28 overflow-y-auto">
                  {selectedDrift.event.raw}
                </pre>
              </div>

              {/* Gemini AI Analysis Box */}
              {selectedDrift.aiAnalysis ? (
                <div className="p-4 rounded-lg bg-emerald-950/10 border border-emerald-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4" />
                      Gemini AI Analysis & Schema Patch
                    </span>
                    <Badge variant="success" className="text-[10px]">
                      Proposed Version: {selectedDrift.aiAnalysis.proposedVersion}
                    </Badge>
                  </div>

                  <p className="text-zinc-300 text-xs leading-relaxed">
                    {selectedDrift.aiAnalysis.rootCauseAnalysis}
                  </p>

                  <div className="pt-2 border-t border-zinc-800/80">
                    <span className="text-[11px] font-mono text-zinc-400 block mb-1.5">PROPOSED RULE PATCHES</span>
                    <div className="space-y-1.5">
                      {selectedDrift.aiAnalysis.suggestedRulePatches.map((patch) => (
                        <div
                          key={patch.input_field}
                          className="flex items-center justify-between p-2 rounded bg-zinc-900/90 border border-zinc-800 text-[11px] font-mono"
                        >
                          <div>
                            <span className="text-amber-400 font-semibold">{patch.input_field}</span>
                            <span className="text-zinc-500 mx-1.5">→</span>
                            <span className="text-emerald-400 font-semibold">{patch.semantic_field}</span>
                            <span className="text-zinc-500 text-[10px] ml-2">({patch.transformation_type})</span>
                          </div>
                          <Badge variant="outline" className="text-[10px]">
                            {Math.round(patch.confidence * 100)}% Match
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-lg bg-zinc-900/60 border border-zinc-800 text-center space-y-2">
                  <Bot className="h-6 w-6 text-zinc-400 mx-auto" />
                  <p className="text-zinc-300 text-xs">
                    Run autonomous Gemini AI reasoning to analyze novel perimeter tokens with prompt sandboxing.
                  </p>
                  <Button
                    variant="emerald"
                    size="sm"
                    onClick={() => handleRunAiAnalysis(selectedDrift)}
                    disabled={isAnalyzing}
                  >
                    <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                    {isAnalyzing ? 'Running Gemini Analysis...' : 'Generate Gemini AI Patch'}
                  </Button>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setSelectedDrift(null)}>
                Close
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
                  Approve Patch & Reprocess
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
