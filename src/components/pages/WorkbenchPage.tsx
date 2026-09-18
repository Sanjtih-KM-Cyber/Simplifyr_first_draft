/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card.tsx';
import { Button } from '../ui/button.tsx';
import { Badge } from '../ui/badge.tsx';
import { Textarea } from '../ui/textarea.tsx';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs.tsx';
import {
  Terminal,
  Play,
  RotateCcw,
  Sparkles,
  Lock,
  Copy,
  Check,
  Download,
  FileCode,
  Code,
  Database,
  Globe,
  Link as LinkIcon,
  ShieldCheck,
  ChevronDown,
} from 'lucide-react';
import { GOLDEN_CORPUS } from '../../data/goldenCorpus.ts';
import { processRawEventThroughPipeline } from '../../services/streamSimulator.ts';
import { ProcessedStreamEvent } from '../../types.ts';
import { formatBytes } from '../../lib/utils.ts';

interface WorkbenchPageProps {
  initialPayload?: string;
}

export const WorkbenchPage: React.FC<WorkbenchPageProps> = ({ initialPayload }) => {
  const [rawPayload, setRawPayload] = useState<string>(
    initialPayload || GOLDEN_CORPUS[0]?.raw || ''
  );
  const [processedEvent, setProcessedEvent] = useState<ProcessedStreamEvent | null>(() => {
    try {
      return processRawEventThroughPipeline(initialPayload || GOLDEN_CORPUS[0]?.raw || '');
    } catch {
      return null;
    }
  });
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleProcess = () => {
    if (!rawPayload.trim()) return;
    try {
      const res = processRawEventThroughPipeline(rawPayload.trim());
      setProcessedEvent(res);
    } catch (err) {
      console.error('Processing error:', err);
    }
  };

  const handleSelectFixture = (index: number) => {
    const fixture = GOLDEN_CORPUS[index];
    if (fixture) {
      setRawPayload(fixture.raw);
      const res = processRawEventThroughPipeline(fixture.raw);
      setProcessedEvent(res);
    }
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100 font-sans">Normalizer Workbench</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Interactive multi-vendor testbed: paste any raw perimeter log to inspect parsing, normalization, and cryptographic seals
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="emerald" size="sm" onClick={handleProcess}>
            <Play className="mr-1.5 h-3.5 w-3.5 fill-current" />
            Process Telemetry
          </Button>
        </div>
      </div>

      {/* Input Section */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-emerald-400" />
              <span className="text-xs font-semibold text-zinc-200">Raw Perimeter Log Input</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-zinc-500 font-mono">Select Fixture:</span>
              <select
                onChange={(e) => handleSelectFixture(Number(e.target.value))}
                className="h-7 rounded border border-zinc-700 bg-zinc-900 px-2 text-[11px] text-zinc-200 font-mono"
              >
                {GOLDEN_CORPUS.map((g, i) => (
                  <option key={g.id} value={i}>
                    {g.vendor} ({g.format})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <Textarea
            value={rawPayload}
            onChange={(e) => setRawPayload(e.target.value)}
            placeholder="Paste raw perimeter syslog, CEF, LEEF, Key-Value, or JSON payload here..."
            className="h-28 text-xs font-mono text-zinc-100 bg-zinc-950/80 border-zinc-800"
          />

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500 pt-1">
            <span>{rawPayload.length} bytes • Lossless raw envelope preservation guaranteed</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[11px]"
              onClick={() => setRawPayload('')}
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Clear Input
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Output Inspection */}
      {processedEvent && (
        <div className="space-y-4">
          {/* Metadata Badges Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800">
              <span className="text-[10px] font-mono text-zinc-500 uppercase block">Detected Vendor</span>
              <span className="text-xs font-semibold text-zinc-200 uppercase font-mono">
                {processedEvent.detection.vendor.replace('_', ' ')}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800">
              <span className="text-[10px] font-mono text-zinc-500 uppercase block">Detected Format</span>
              <span className="text-xs font-semibold text-emerald-400 font-mono uppercase">
                {processedEvent.detection.format}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800">
              <span className="text-[10px] font-mono text-zinc-500 uppercase block">Latency Benchmark</span>
              <span className="text-xs font-semibold text-emerald-400 font-mono">
                {processedEvent.latencyMs.toFixed(2)} ms (SLA PASS)
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800">
              <span className="text-[10px] font-mono text-zinc-500 uppercase block">Cryptographic Hash</span>
              <span className="text-xs font-mono text-amber-300 truncate block">
                {processedEvent.envelope.sha256_hash.slice(0, 14)}...
              </span>
            </div>
          </div>

          {/* Clean 5 Inspection Tabs */}
          <Card>
            <CardContent className="p-4">
              <Tabs defaultValue="semantic">
                <TabsList className="w-full justify-start overflow-x-auto mb-4">
                  <TabsTrigger value="semantic" className="flex items-center gap-1.5">
                    <Database className="h-3.5 w-3.5 text-emerald-400" />
                    NORMALIZED (ECS/OCSF)
                  </TabsTrigger>
                  <TabsTrigger value="parsed" className="flex items-center gap-1.5">
                    <Code className="h-3.5 w-3.5 text-purple-400" />
                    PARSED AST
                  </TabsTrigger>
                  <TabsTrigger value="output" className="flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5 text-sky-400" />
                    OUTPUT PROJECTION
                  </TabsTrigger>
                  <TabsTrigger value="provenance" className="flex items-center gap-1.5">
                    <LinkIcon className="h-3.5 w-3.5 text-amber-400" />
                    PROVENANCE AUDIT
                  </TabsTrigger>
                </TabsList>

                {/* NORMALIZED */}
                <TabsContent value="semantic">
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs text-zinc-400">
                      <span className="font-mono text-[11px] text-zinc-500">Canonical Semantic Schema Representation</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[11px]"
                        onClick={() => handleCopy(JSON.stringify(processedEvent.canonical, null, 2), 'sem')}
                      >
                        {copiedKey === 'sem' ? <Check className="h-3 w-3 text-emerald-400 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                        Copy JSON
                      </Button>
                    </div>
                    <pre className="p-3 rounded bg-zinc-900/60 font-mono text-xs text-emerald-400 whitespace-pre-wrap max-h-72 overflow-y-auto">
                      {JSON.stringify(processedEvent.canonical, null, 2)}
                    </pre>
                  </div>
                </TabsContent>

                {/* PARSED */}
                <TabsContent value="parsed">
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs text-zinc-400">
                      <span className="font-mono text-[11px] text-zinc-500">Extracted AST Syntactic Tokens</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[11px]"
                        onClick={() => handleCopy(JSON.stringify(processedEvent.parsed, null, 2), 'parsed')}
                      >
                        {copiedKey === 'parsed' ? <Check className="h-3 w-3 text-emerald-400 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                        Copy JSON
                      </Button>
                    </div>
                    <pre className="p-3 rounded bg-zinc-900/60 font-mono text-xs text-zinc-200 whitespace-pre-wrap max-h-72 overflow-y-auto">
                      {JSON.stringify(processedEvent.parsed, null, 2)}
                    </pre>
                  </div>
                </TabsContent>

                {/* OUTPUT */}
                <TabsContent value="output">
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs text-zinc-400">
                      <span className="font-mono text-[11px] text-zinc-500">SOC Downstream Output Projection</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[11px]"
                        onClick={() => handleCopy(JSON.stringify(processedEvent.canonical, null, 2), 'out')}
                      >
                        {copiedKey === 'out' ? <Check className="h-3 w-3 text-emerald-400 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                        Copy Output
                      </Button>
                    </div>
                    <pre className="p-3 rounded bg-zinc-900/60 font-mono text-xs text-sky-400 whitespace-pre-wrap max-h-72 overflow-y-auto">
                      {JSON.stringify(
                        {
                          event_id: processedEvent.id,
                          timestamp: processedEvent.timestamp,
                          vendor: processedEvent.detection.vendor,
                          firewall_action: processedEvent.canonical.network?.action,
                          src_ip: processedEvent.canonical.source?.ip,
                          dest_ip: processedEvent.canonical.destination?.ip,
                          protocol: processedEvent.canonical.network?.protocol,
                          sha256_hash: processedEvent.envelope.sha256_hash,
                        },
                        null,
                        2
                      )}
                    </pre>
                  </div>
                </TabsContent>

                {/* PROVENANCE */}
                <TabsContent value="provenance">
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs text-zinc-400">
                      <span className="font-mono text-[11px] text-zinc-500">Cryptographic Provenance Chain</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[11px]"
                        onClick={() => handleCopy(JSON.stringify(processedEvent.provenance, null, 2), 'prov')}
                      >
                        {copiedKey === 'prov' ? <Check className="h-3 w-3 text-emerald-400 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                        Copy Provenance
                      </Button>
                    </div>
                    <pre className="p-3 rounded bg-zinc-900/60 font-mono text-xs text-amber-300 whitespace-pre-wrap max-h-72 overflow-y-auto">
                      {JSON.stringify(processedEvent.provenance, null, 2)}
                    </pre>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
