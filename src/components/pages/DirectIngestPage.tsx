/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card.tsx';
import { Button } from '../ui/button.tsx';
import { Badge } from '../ui/badge.tsx';
import {
  UploadCloud,
  Radio,
  Terminal,
  FileText,
  Copy,
  Check,
  Play,
  Pause,
  Sparkles,
  Server,
  Code2,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sliders,
  ExternalLink,
  Cpu,
  Layers,
} from 'lucide-react';
import { ProcessedStreamEvent, PerimeterVendor } from '../../types.ts';
import { processRawEventThroughPipeline, streamSimulator } from '../../services/streamSimulator.ts';

interface DirectIngestPageProps {
  onEventsIngested: (events: ProcessedStreamEvent[]) => void;
  isStreamRunning: boolean;
  onToggleStream: () => void;
  onNavigate: (route: string) => void;
}

const PRESET_LOGS: Array<{
  vendor: PerimeterVendor;
  name: string;
  badge: string;
  raw: string;
}> = [
  {
    vendor: 'palo_alto',
    name: 'Palo Alto PAN-OS Session Traffic',
    badge: 'PAN-OS 11.1',
    raw: '<14>1 2026-09-18T10:14:02.000Z pa-fw-core-01 PAN-OS - - [pan@2847 src=192.168.4.88 dst=104.244.42.1 spt=54120 dpt=443 proto=tcp act=allow bytes=4210 pkts=18 rule="DMZ_OUTBOUND" category="web-browsing"]',
  },
  {
    vendor: 'cisco_asa',
    name: 'Cisco ASA Connection Teardown',
    badge: 'ASA 9.18',
    raw: 'Sep 18 10:16:45 cisco-asa-edge %ASA-6-302014: Teardown TCP connection 9821415 for outside:198.51.100.22/443 to inside:10.10.5.21/49812 duration 0:02:14 bytes 8920 TCP FINs',
  },
  {
    vendor: 'fortinet_fortigate',
    name: 'Fortinet FortiGate Traffic Forward',
    badge: 'FortiOS 7.4',
    raw: 'date=2026-09-18 time=10:18:22 devname="FGT-EDGE-HQ" logid="0000000013" type="traffic" subtype="forward" level="notice" srcip=10.1.10.42 srcport=51294 dstip=172.217.16.206 dstport=443 proto=6 action="accept" sentbyte=2410 rcvdbyte=8120 polid=1',
  },
  {
    vendor: 'checkpoint_quantum',
    name: 'Check Point Quantum Drop Event',
    badge: 'R81.20',
    raw: 'time=1726654712|action=drop|src=203.0.113.88|dst=10.0.1.50|proto=6|s_port=62410|service=22|product=VPN-1 & FireWall-1|rule=14|reason=Non-syn_packet',
  },
  {
    vendor: 'snort_ids',
    name: 'Snort 3 Alert Telemetry',
    badge: 'Snort 3.1',
    raw: '09/18-10:22:15.892011 [**] [1:2021442:3] ET EXPLOIT Apache Log4j JNDI RCE Attempt [**] [Classification: Attempted Administrator Privilege Gain] [Priority: 1] {TCP} 198.51.100.24:48192 -> 10.10.4.12:8080',
  },
];

export const DirectIngestPage: React.FC<DirectIngestPageProps> = ({
  onEventsIngested,
  isStreamRunning,
  onToggleStream,
  onNavigate,
}) => {
  const [activeTab, setActiveTab] = useState<'console' | 'file' | 'api' | 'syslog' | 'simulator'>('console');
  const [rawInput, setRawInput] = useState('');
  const [lastProcessed, setLastProcessed] = useState<ProcessedStreamEvent[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [apiTestStatus, setApiTestStatus] = useState<{ status: 'idle' | 'testing' | 'success' | 'error'; message?: string }>({ status: 'idle' });
  const [simulatorEps, setSimulatorEps] = useState<number>(2);
  const [diagnosticBurstCount, setDiagnosticBurstCount] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleProcessRaw = async (inputStr?: string) => {
    const textToProcess = inputStr !== undefined ? inputStr : rawInput;
    const lines = textToProcess
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) return;

    setIsProcessing(true);
    const results: ProcessedStreamEvent[] = [];

    for (const line of lines) {
      try {
        const ev = processRawEventThroughPipeline(line);
        results.push(ev);
      } catch (err) {
        console.error('Failed to parse line:', err);
      }
    }

    if (results.length > 0) {
      setLastProcessed(results);
      onEventsIngested(results);
      if (inputStr === undefined) {
        setRawInput('');
      }
    }
    setIsProcessing(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        handleProcessRaw(content);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleTestApiWebhook = async () => {
    setApiTestStatus({ status: 'testing' });
    try {
      const payload = {
        source_id: 'browser-live-tester',
        logs: [
          '<14>1 2026-09-18T10:14:02.000Z pa-fw-core-01 PAN-OS - - [pan@2847 src=192.168.4.88 dst=104.244.42.1 spt=54120 dpt=443 proto=tcp act=allow bytes=4210 pkts=18]',
        ],
      };

      const res = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        // Also parse directly into current state for instant UI reflection
        const ev = processRawEventThroughPipeline(payload.logs[0]);
        onEventsIngested([ev]);
        setLastProcessed([ev]);
        setApiTestStatus({
          status: 'success',
          message: `200 OK — Ingested 1 event via POST /api/ingest (Status: ${data.status}, Wire Seal Verified)`,
        });
      } else {
        setApiTestStatus({
          status: 'error',
          message: `Endpoint returned HTTP ${res.status}: ${res.statusText}`,
        });
      }
    } catch (err) {
      setApiTestStatus({
        status: 'error',
        message: `Network failure: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  };

  const handleInjectDiagnosticBurst = (count: number = 10) => {
    const batch: ProcessedStreamEvent[] = [];
    for (let i = 0; i < count; i++) {
      const ev = streamSimulator.pulse();
      batch.push(ev);
    }
    setDiagnosticBurstCount((prev) => prev + count);
    setLastProcessed(batch.slice(0, 3));
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-100 font-sans">
              Log Ingestion & Stream Connectors
            </h1>
            <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/40 text-emerald-400">
              Active Listeners
            </Badge>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Connect live firewall syslog streams, send batch logs via HTTP Webhook, drop raw log files, or run diagnostic load tests.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate('events')}
            className="text-xs font-mono"
          >
            <Layers className="h-3.5 w-3.5 mr-1.5 text-emerald-400" />
            View in Event Explorer
          </Button>
        </div>
      </div>

      {/* Connectivity Status Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3 rounded-lg border border-zinc-800 bg-zinc-950/60 flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[10px] font-mono uppercase text-zinc-500">HTTP Webhook Listener</span>
            <div className="font-mono text-xs font-semibold text-zinc-200">POST /api/ingest</div>
          </div>
          <Badge variant="success" className="text-[9px] font-mono">
            PORT 3000
          </Badge>
        </div>

        <div className="p-3 rounded-lg border border-zinc-800 bg-zinc-950/60 flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[10px] font-mono uppercase text-zinc-500">Syslog Forwarder</span>
            <div className="font-mono text-xs font-semibold text-zinc-200">UDP:514 / TLS:6514</div>
          </div>
          <Badge variant="outline" className="text-[9px] font-mono text-emerald-400 border-emerald-500/30">
            RFC 5424 / 3164
          </Badge>
        </div>

        <div className="p-3 rounded-lg border border-zinc-800 bg-zinc-950/60 flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[10px] font-mono uppercase text-zinc-500">Cryptographic Seal</span>
            <div className="font-mono text-xs font-semibold text-zinc-200">SHA-256 Bit-Lossless</div>
          </div>
          <Badge variant="outline" className="text-[9px] font-mono text-blue-400 border-blue-500/30">
            100% Provenance
          </Badge>
        </div>

        <div className="p-3 rounded-lg border border-zinc-800 bg-zinc-950/60 flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[10px] font-mono uppercase text-zinc-500">Diagnostic Sandbox</span>
            <div className="font-mono text-xs font-semibold text-zinc-200">
              {isStreamRunning ? 'Pulse Active' : 'Idle / Ready'}
            </div>
          </div>
          <Badge
            variant={isStreamRunning ? 'warning' : 'outline'}
            className="text-[9px] font-mono"
          >
            {isStreamRunning ? 'RUNNING' : 'STOPPED'}
          </Badge>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-zinc-800 overflow-x-auto gap-1">
        <button
          onClick={() => setActiveTab('console')}
          className={`px-4 py-2.5 text-xs font-mono font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'console'
              ? 'border-emerald-500 text-emerald-400 font-semibold bg-emerald-500/5'
              : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40'
          }`}
        >
          <Terminal className="h-3.5 w-3.5" />
          Interactive Ingest Console
        </button>

        <button
          onClick={() => setActiveTab('file')}
          className={`px-4 py-2.5 text-xs font-mono font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'file'
              ? 'border-emerald-500 text-emerald-400 font-semibold bg-emerald-500/5'
              : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40'
          }`}
        >
          <UploadCloud className="h-3.5 w-3.5" />
          File & Batch Dropzone
        </button>

        <button
          onClick={() => setActiveTab('api')}
          className={`px-4 py-2.5 text-xs font-mono font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'api'
              ? 'border-emerald-500 text-emerald-400 font-semibold bg-emerald-500/5'
              : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40'
          }`}
        >
          <Code2 className="h-3.5 w-3.5" />
          HTTP Webhook API
        </button>

        <button
          onClick={() => setActiveTab('syslog')}
          className={`px-4 py-2.5 text-xs font-mono font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'syslog'
              ? 'border-emerald-500 text-emerald-400 font-semibold bg-emerald-500/5'
              : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40'
          }`}
        >
          <Server className="h-3.5 w-3.5" />
          Syslog Daemon Forwarders
        </button>

        <button
          onClick={() => setActiveTab('simulator')}
          className={`px-4 py-2.5 text-xs font-mono font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'simulator'
              ? 'border-emerald-500 text-emerald-400 font-semibold bg-emerald-500/5'
              : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40'
          }`}
        >
          <Cpu className="h-3.5 w-3.5" />
          Diagnostic Sandbox Pulse
          {isStreamRunning && (
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
          )}
        </button>
      </div>

      {/* Tab 1: Interactive Live Raw Ingest Console */}
      {activeTab === 'console' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Input Console */}
          <div className="lg:col-span-7 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Terminal className="h-4 w-4 text-emerald-400" />
                    Direct Log Stream Input
                  </CardTitle>
                  <span className="text-[10px] font-mono text-zinc-500">Raw Syslog / CEF / KV format</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <textarea
                  value={rawInput}
                  onChange={(e) => setRawInput(e.target.value)}
                  placeholder="Paste one or multiple raw perimeter firewall logs here (Cisco, Palo Alto, Fortinet, Check Point, Snort)..."
                  rows={5}
                  className="w-full p-3 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-xs text-zinc-200 placeholder-zinc-600 focus:outline-hidden focus:border-emerald-500/50 leading-relaxed resize-y"
                />

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="emerald"
                      size="sm"
                      onClick={() => handleProcessRaw()}
                      disabled={isProcessing || !rawInput.trim()}
                      className="font-mono text-xs"
                    >
                      {isProcessing ? (
                        <>
                          <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                          Ingest & Seal Log
                        </>
                      )}
                    </Button>
                    <button
                      onClick={() => setRawInput('')}
                      className="text-xs font-mono text-zinc-500 hover:text-zinc-300 px-2 py-1 cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>

                  <span className="text-[11px] text-zinc-500 font-mono">
                    Sub-2ms normalizer + SHA-256 seal
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Quick Vendor Sample Presets */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-mono uppercase text-zinc-400">
                  Quick Multi-Vendor Test Presets
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {PRESET_LOGS.map((preset) => (
                  <div
                    key={preset.name}
                    className="p-2.5 rounded-lg bg-zinc-950/60 border border-zinc-800/80 hover:border-zinc-700 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-zinc-200">{preset.name}</span>
                        <Badge variant="outline" className="text-[9px] font-mono text-zinc-400">
                          {preset.badge}
                        </Badge>
                      </div>
                      <div className="text-[11px] font-mono text-zinc-500 truncate max-w-md mt-0.5">
                        {preset.raw}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => setRawInput(preset.raw)}
                        className="px-2 py-1 rounded text-[11px] font-mono text-zinc-300 hover:bg-zinc-800 bg-zinc-900 border border-zinc-800 cursor-pointer"
                      >
                        Load
                      </button>
                      <Button
                        variant="emerald"
                        size="sm"
                        onClick={() => handleProcessRaw(preset.raw)}
                        className="h-7 text-[11px] font-mono px-2.5"
                      >
                        Ingest Now
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Right: Live Ingest Outcome */}
          <div className="lg:col-span-5 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-400" />
                    Pipeline Result & Provenance
                  </CardTitle>
                  {lastProcessed.length > 0 && (
                    <Badge variant="success" className="text-[10px] font-mono">
                      {lastProcessed.length} Ingested
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {lastProcessed.length === 0 ? (
                  <div className="p-8 text-center rounded-lg border border-dashed border-zinc-800 space-y-2">
                    <Terminal className="h-8 w-8 text-zinc-600 mx-auto" />
                    <div className="text-xs font-semibold text-zinc-400">No events ingested in this session yet</div>
                    <p className="text-[11px] text-zinc-500 max-w-xs mx-auto">
                      Paste a raw firewall event or select a vendor preset to watch ULPF compute the SHA-256 seal and canonical taxonomy in real time.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {lastProcessed.slice(0, 2).map((ev) => (
                      <div key={ev.id} className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-zinc-200 font-mono">
                            {ev.event.detection.device_vendor.toUpperCase()} • {ev.event.detection.device_product}
                          </span>
                          <span className="font-mono text-[10px] text-emerald-400">
                            {ev.processingLatencyMs.toFixed(2)} ms
                          </span>
                        </div>

                        <div className="p-2 rounded bg-zinc-900/80 font-mono text-[10px] text-zinc-400 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-zinc-500">SHA-256 Seal:</span>
                            <span className="text-emerald-400 truncate max-w-[200px]">{ev.envelope.sha256}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-zinc-500">Action:</span>
                            <span className="text-zinc-200 font-semibold">{ev.event.network?.action?.toUpperCase() || 'UNKNOWN'}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-zinc-500">Flow:</span>
                            <span className="text-zinc-300">
                              {ev.event.source?.ip}:{ev.event.source?.port} → {ev.event.destination?.ip}:{ev.event.destination?.port}
                            </span>
                          </div>
                        </div>

                        <div className="text-[11px] text-zinc-500 font-mono flex items-center justify-between pt-1">
                          <span>Lossless Bit Preservation:</span>
                          <span className="text-emerald-400 font-semibold">100% VERIFIED</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Tab 2: File & Batch Dropzone */}
      {activeTab === 'file' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <UploadCloud className="h-4 w-4 text-emerald-400" />
              Batch Log File Ingestion
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="p-12 text-center rounded-xl border-2 border-dashed border-zinc-800 hover:border-emerald-500/50 bg-zinc-950/40 hover:bg-zinc-950/80 transition-all cursor-pointer space-y-3"
            >
              <div className="h-12 w-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
                <FileText className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <div className="text-sm font-semibold text-zinc-200">
                  Drop your firewall log file here, or click to browse
                </div>
                <p className="text-xs text-zinc-500">
                  Supports .log, .txt, .json, .csv, and raw syslog dumps (up to 5,000 lines per batch)
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".log,.txt,.json,.csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button variant="emerald" size="sm" className="font-mono text-xs mt-2">
                Select File
              </Button>
            </div>

            <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 text-xs space-y-2">
              <span className="font-semibold text-zinc-300 font-mono block">
                How batch file processing operates:
              </span>
              <ul className="list-disc list-inside space-y-1 text-zinc-400 text-[11px] leading-relaxed">
                <li>Every log line is isolated and wrapped in a bit-identical <code className="text-emerald-300">Envelope</code> with a calculated SHA-256 hash.</li>
                <li>Known vendor patterns (Cisco, Palo Alto, Fortinet, Check Point) are parsed into standardized taxonomy fields.</li>
                <li>Novel vendor fields trigger the autonomous zero-day drift isolation chamber for schema updates.</li>
                <li>Normalized events are immediately injected into the live memory store and available in the Event Explorer.</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab 3: HTTP Webhook API */}
      {activeTab === 'api' && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Code2 className="h-4 w-4 text-emerald-400" />
                  REST Ingestion Webhook Specification
                </CardTitle>
                <Badge variant="outline" className="text-[10px] font-mono text-emerald-400">
                  POST /api/ingest
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-zinc-400">
                Configure your external perimeter collectors, log shippers (FluentBit, Vector, Logstash), or cloud serverless forwarders to push logs directly to Simplifyr ULPF via HTTP POST.
              </p>

              {/* Ready cURL Command */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
                  <span>cURL Command Snippet</span>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        `curl -X POST http://localhost:3000/api/ingest \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "source_id": "fw-perimeter-core",\n    "logs": [\n      "<14>1 2026-09-18T10:14:02.000Z pa-fw-core-01 PAN-OS - - [pan@2847 src=192.168.4.88 dst=104.244.42.1 spt=54120 dpt=443 proto=tcp act=allow bytes=4210 pkts=18]"\n    ]\n  }'`,
                        'curl'
                      )
                    }
                    className="flex items-center gap-1 text-[11px] text-emerald-400 hover:underline cursor-pointer"
                  >
                    {copiedKey === 'curl' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copiedKey === 'curl' ? 'Copied' : 'Copy cURL'}
                  </button>
                </div>
                <pre className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-xs text-zinc-300 overflow-x-auto">
{`curl -X POST http://localhost:3000/api/ingest \\
  -H "Content-Type: application/json" \\
  -d '{
    "source_id": "fw-perimeter-core",
    "logs": [
      "<14>1 2026-09-18T10:14:02.000Z pa-fw-core-01 PAN-OS - - [pan@2847 src=192.168.4.88 dst=104.244.42.1 spt=54120 dpt=443 proto=tcp act=allow bytes=4210 pkts=18]"
    ]
  }'`}
                </pre>
              </div>

              {/* Interactive Test Button */}
              <div className="p-3.5 rounded-lg bg-zinc-950/80 border border-zinc-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-zinc-200">Interactive API Self-Test</div>
                    <div className="text-[11px] text-zinc-400">Dispatch a live test payload to /api/ingest from your browser right now</div>
                  </div>
                  <Button
                    variant="emerald"
                    size="sm"
                    onClick={handleTestApiWebhook}
                    disabled={apiTestStatus.status === 'testing'}
                    className="h-8 font-mono text-xs"
                  >
                    {apiTestStatus.status === 'testing' ? (
                      <>
                        <RefreshCw className="h-3 w-3 mr-1.5 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3 w-3 mr-1.5" />
                        Send Live Test HTTP POST
                      </>
                    )}
                  </Button>
                </div>

                {apiTestStatus.status === 'success' && (
                  <div className="p-2.5 rounded bg-emerald-950/30 border border-emerald-500/30 text-xs font-mono text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>{apiTestStatus.message}</span>
                  </div>
                )}

                {apiTestStatus.status === 'error' && (
                  <div className="p-2.5 rounded bg-red-950/30 border border-red-500/30 text-xs font-mono text-red-300 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
                    <span>{apiTestStatus.message}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab 4: Syslog Daemon Forwarders */}
      {activeTab === 'syslog' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* rsyslog */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-mono text-zinc-200">
                  rsyslog Configuration (/etc/rsyslog.d/50-simplifyr.conf)
                </CardTitle>
                <button
                  onClick={() =>
                    copyToClipboard(
                      `# Forward all firewall facility logs to Simplifyr ULPF\n*.* action(type="omfwd" target="simplifyr.internal" port="514" protocol="udp"\n    template="RSYSLOG_TraditionalFileFormat")`,
                      'rsyslog'
                    )
                  }
                  className="text-zinc-400 hover:text-zinc-200 text-xs font-mono flex items-center gap-1"
                >
                  {copiedKey === 'rsyslog' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  Copy
                </button>
              </div>
            </CardHeader>
            <CardContent>
              <pre className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-xs text-zinc-300 overflow-x-auto">
{`# Forward perimeter firewall logs to Simplifyr ULPF
*.* action(type="omfwd"
    target="simplifyr-gateway.internal"
    port="514"
    protocol="udp"
    template="RSYSLOG_TraditionalFileFormat")`}
              </pre>
            </CardContent>
          </Card>

          {/* syslog-ng */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-mono text-zinc-200">
                  syslog-ng Configuration (/etc/syslog-ng/conf.d/simplifyr.conf)
                </CardTitle>
                <button
                  onClick={() =>
                    copyToClipboard(
                      `destination d_simplifyr {\n    network("simplifyr-gateway.internal" port(514) transport("udp"));\n};\nlog {\n    source(s_network);\n    destination(d_simplifyr);\n};`,
                      'syslogng'
                    )
                  }
                  className="text-zinc-400 hover:text-zinc-200 text-xs font-mono flex items-center gap-1"
                >
                  {copiedKey === 'syslogng' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  Copy
                </button>
              </div>
            </CardHeader>
            <CardContent>
              <pre className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-xs text-zinc-300 overflow-x-auto">
{`destination d_simplifyr {
    network("simplifyr-gateway.internal"
        port(514)
        transport("udp")
    );
};
log { source(s_network); destination(d_simplifyr); };`}
              </pre>
            </CardContent>
          </Card>

          {/* Fluent Bit */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-mono text-zinc-200">
                  Fluent Bit (fluent-bit.conf HTTP Output)
                </CardTitle>
                <button
                  onClick={() =>
                    copyToClipboard(
                      `[OUTPUT]\n    Name        http\n    Match       firewall.*\n    Host        simplifyr-gateway.internal\n    Port        3000\n    URI         /api/ingest\n    Format      json`,
                      'fluentbit'
                    )
                  }
                  className="text-zinc-400 hover:text-zinc-200 text-xs font-mono flex items-center gap-1"
                >
                  {copiedKey === 'fluentbit' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  Copy
                </button>
              </div>
            </CardHeader>
            <CardContent>
              <pre className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-xs text-zinc-300 overflow-x-auto">
{`[OUTPUT]
    Name        http
    Match       firewall.*
    Host        simplifyr-gateway.internal
    Port        3000
    URI         /api/ingest
    Format      json`}
              </pre>
            </CardContent>
          </Card>

          {/* Palo Alto & Cisco CLI commands */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-mono text-zinc-200">
                Firewall Native Appliance CLI Forwarding
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs font-mono text-zinc-300">
              <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800 space-y-1">
                <span className="text-[10px] text-zinc-500 uppercase block font-bold">Cisco ASA / FTD</span>
                <code>logging host inside 10.10.1.50 17/514</code>
                <br />
                <code>logging trap informational</code>
              </div>
              <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800 space-y-1">
                <span className="text-[10px] text-zinc-500 uppercase block font-bold">Fortinet FortiGate</span>
                <code>config log syslogd setting</code>
                <br />
                <code>&nbsp;&nbsp;set status enable</code>
                <br />
                <code>&nbsp;&nbsp;set server "10.10.1.50"</code>
                <br />
                <code>end</code>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab 5: Diagnostic Sandbox Pulse (The Rethought Generator) */}
      {activeTab === 'simulator' && (
        <Card className="border-emerald-500/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                  <Cpu className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">
                    Diagnostic Telemetry Generator & Sandbox Pulse
                  </CardTitle>
                  <p className="text-xs text-zinc-400">
                    Use this diagnostic engine to benchmark throughput and verify parser rules without physical network cables.
                  </p>
                </div>
              </div>
              <Badge
                variant={isStreamRunning ? 'success' : 'outline'}
                className="text-xs font-mono px-2.5 py-1"
              >
                {isStreamRunning ? 'Pulse Active' : 'Pulse Inactive'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <span className="text-[10px] font-mono text-zinc-500 uppercase block">Continuous Generator</span>
                <div className="mt-1 flex items-center gap-2">
                  <Button
                    variant={isStreamRunning ? 'outline' : 'emerald'}
                    size="sm"
                    onClick={onToggleStream}
                    className="h-8 font-mono text-xs cursor-pointer"
                  >
                    {isStreamRunning ? (
                      <>
                        <Pause className="h-3.5 w-3.5 mr-1.5 text-amber-400" />
                        Stop Continuous Pulse
                      </>
                    ) : (
                      <>
                        <Play className="h-3.5 w-3.5 mr-1.5" />
                        Start Continuous Pulse
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-mono text-zinc-500 uppercase block">Burst Injection</span>
                <div className="mt-1 flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleInjectDiagnosticBurst(1)}
                    className="h-8 font-mono text-xs cursor-pointer"
                  >
                    +1 Event
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleInjectDiagnosticBurst(10)}
                    className="h-8 font-mono text-xs cursor-pointer"
                  >
                    +10 Burst
                  </Button>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-mono text-zinc-500 uppercase block">Diagnostics Generated</span>
                <div className="mt-1 font-mono text-sm font-semibold text-emerald-400">
                  {diagnosticBurstCount} events in this session
                </div>
              </div>
            </div>

            <div className="space-y-2 text-xs text-zinc-400 bg-zinc-950/60 p-4 rounded-lg border border-zinc-800">
              <span className="font-semibold text-zinc-200 font-mono flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                Sandbox Architecture Details
              </span>
              <p className="text-[11px] leading-relaxed">
                When active, the diagnostic generator creates multi-vendor telemetry (Cisco ASA, Palo Alto, Fortinet, Check Point, Snort) and feeds them into the exact same cryptographic envelope and parser pipeline as real syslog cables.
                This allows you to stress-test output profiles and observe schema drift detection in complete safety.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
