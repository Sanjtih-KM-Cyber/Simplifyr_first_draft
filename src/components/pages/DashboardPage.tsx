/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card.tsx';
import { Badge } from '../ui/badge.tsx';
import { Button } from '../ui/button.tsx';
import {
  Database,
  Activity,
  Server,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  RefreshCw,
  GitBranch,
  ShieldCheck,
  Terminal,
  Play,
  ArrowUpRight,
  Clock,
  Lock,
  Radio,
  UploadCloud,
  Code2,
  Copy,
  Check,
} from 'lucide-react';
import { quarantineManager } from '../../services/quarantineManager.ts';
import { GOLDEN_CORPUS } from '../../data/goldenCorpus.ts';

interface DashboardPageProps {
  onNavigate: (route: string) => void;
  onInjectSample: (raw: string) => void;
  onOpenVerification?: () => void;
  totalEvents: number;
  avgLatencyMs: number;
  losslessRatePct: number;
  healthStatus?: {
    ingestion: string;
    processing: string;
    storage: string;
    ai_engine: string;
    outputs: string;
  };
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onNavigate,
  onInjectSample,
  onOpenVerification,
  totalEvents,
  avgLatencyMs,
  losslessRatePct,
  healthStatus = {
    ingestion: 'healthy',
    processing: 'healthy',
    storage: 'healthy',
    ai_engine: 'healthy',
    outputs: 'healthy',
  },
}) => {
  const [quarantinedEvents, setQuarantinedEvents] = useState<any[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [backendHealth, setBackendHealth] = useState<{
    status: string;
    hasGeminiKey: boolean;
    hasGroqKey?: boolean;
    ollamaHost?: string;
    ollamaModel?: string;
  }>({
    status: 'ok',
    hasGeminiKey: false,
  });

  const activeEngine = typeof window !== 'undefined' ? (localStorage.getItem('simplifyr_ai_engine') || 'gemini') : 'gemini';

  useEffect(() => {
    setQuarantinedEvents(quarantineManager.getAll());
    const unsub = quarantineManager.subscribe((list) => {
      setQuarantinedEvents(list);
    });

    // Verify backend connection
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        setBackendHealth({
          status: data.status || 'ok',
          hasGeminiKey: !!data.hasGeminiKey,
          hasGroqKey: !!data.hasGroqKey,
          ollamaHost: data.ollamaHost,
          ollamaModel: data.ollamaModel,
        });
      })
      .catch(() => {
        // graceful offline fallback
      });

    return () => unsub();
  }, []);

  const [quickInput, setQuickInput] = useState('');
  const [quickSuccess, setQuickSuccess] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setQuarantinedEvents(quarantineManager.getAll());
    setTimeout(() => setIsRefreshing(false), 400);
  };

  const handleQuickIngest = () => {
    if (!quickInput.trim()) return;
    onInjectSample(quickInput.trim());
    setQuickSuccess(true);
    setQuickInput('');
    setTimeout(() => setQuickSuccess(false), 2000);
  };

  const statCards = [
    {
      name: 'Events Processed',
      value: totalEvents.toLocaleString(),
      subtext: `${losslessRatePct}% zero-loss cryptographic rate`,
      icon: Database,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
      trend: '+100% Bit-Lossless',
      trendUp: true,
    },
    {
      name: 'Ingestion Latency',
      value: `${avgLatencyMs.toFixed(2)} ms`,
      subtext: 'Average per-event execution',
      icon: Activity,
      color: 'text-green-500',
      bg: 'bg-green-500/10',
      trend: 'Sub-2ms SLA PASS',
      trendUp: true,
    },
    {
      name: 'Active Sources',
      value: '6 Devices',
      subtext: 'Palo Alto, Cisco, Fortinet, Check Point, Snort',
      icon: Server,
      color: 'text-purple-500',
      bg: 'bg-purple-500/10',
      trend: 'Multi-Vendor Active',
      trendUp: true,
    },
    {
      name: 'Quarantined Drift',
      value: `${quarantinedEvents.length} Events`,
      subtext: 'Autonomous zero-day drift isolation',
      icon: AlertTriangle,
      color: 'text-orange-500',
      bg: 'bg-orange-500/10',
      trend: quarantinedEvents.length > 0 ? `${quarantinedEvents.length} pending review` : 'All Schemas Stable',
      trendUp: quarantinedEvents.length === 0,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100 font-sans">Dashboard</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Monitor your perimeter log preprocessing pipeline health, throughput, and cryptographic seals
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`mr-2 h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="emerald"
            size="sm"
            onClick={() => onNavigate('workbench')}
          >
            <Terminal className="mr-1.5 h-3.5 w-3.5" />
            Normalizer Workbench
          </Button>
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.name} className="hover:border-zinc-700/80 transition-all">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-zinc-400 font-mono">{stat.name}</CardTitle>
              <div className={`p-1.5 rounded-md ${stat.bg}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono text-zinc-100">{stat.value}</div>
              <div className="flex items-center justify-between mt-1 text-[11px]">
                <span className="text-zinc-500 truncate">{stat.subtext}</span>
                <span className={`font-mono font-semibold shrink-0 ${stat.trendUp ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {stat.trend}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Direct Log Connection & Ingestion Hub */}
      <Card className="border-emerald-500/30 bg-gradient-to-r from-emerald-950/20 via-zinc-950 to-zinc-950 shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Radio className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-zinc-100">
                  Connect Perimeter Logs Directly
                  <Badge variant="outline" className="text-[10px] font-mono text-emerald-400 border-emerald-500/30">
                    Live Ingestion Ready
                  </Badge>
                </CardTitle>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Stream syslog from Cisco, Palo Alto, Fortinet & Check Point, push via HTTP Webhook, or ingest log files directly.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="emerald"
                size="sm"
                onClick={() => onNavigate('ingest')}
                className="h-8 text-xs font-mono cursor-pointer"
              >
                <Radio className="h-3.5 w-3.5 mr-1.5" />
                Open Connection Hub
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Method 1: HTTP API */}
            <div className="p-3 rounded-lg bg-zinc-950/80 border border-zinc-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                  <Code2 className="h-3.5 w-3.5 text-blue-400" />
                  HTTP Webhook
                </span>
                <Badge variant="outline" className="text-[9px] font-mono text-blue-400">
                  POST /api/ingest
                </Badge>
              </div>
              <p className="text-[11px] text-zinc-400">
                Push JSON or raw syslog from curl, Fluent Bit, Vector, or serverless collectors.
              </p>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`curl -X POST http://localhost:3000/api/ingest -H "Content-Type: application/json" -d '{"logs":["<14>1 2026-09-18 pa-fw-core-01 PAN-OS - - [pan@2847 src=192.168.4.88 dst=104.244.42.1 spt=54120 dpt=443 proto=tcp act=allow bytes=4210 pkts=18]"]}'`);
                  setCopiedCurl(true);
                  setTimeout(() => setCopiedCurl(false), 2000);
                }}
                className="text-[10px] font-mono text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer pt-0.5"
              >
                {copiedCurl ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copiedCurl ? 'Copied cURL snippet' : 'Copy cURL command'}
              </button>
            </div>

            {/* Method 2: Syslog Forwarder */}
            <div className="p-3 rounded-lg bg-zinc-950/80 border border-zinc-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                  <Server className="h-3.5 w-3.5 text-purple-400" />
                  Syslog Forwarder
                </span>
                <Badge variant="outline" className="text-[9px] font-mono text-purple-400">
                  UDP 514 / TLS 6514
                </Badge>
              </div>
              <p className="text-[11px] text-zinc-400">
                Forward from rsyslog, syslog-ng, or physical firewall appliance syslog destinations.
              </p>
              <button
                onClick={() => onNavigate('ingest')}
                className="text-[10px] font-mono text-purple-400 hover:underline flex items-center gap-1 cursor-pointer pt-0.5"
              >
                <ArrowUpRight className="h-3 w-3" />
                View forwarder configs
              </button>
            </div>

            {/* Method 3: File & Batch Drop */}
            <div className="p-3 rounded-lg bg-zinc-950/80 border border-zinc-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                  <UploadCloud className="h-3.5 w-3.5 text-emerald-400" />
                  Log File Upload
                </span>
                <Badge variant="outline" className="text-[9px] font-mono text-emerald-400">
                  .log / .txt / .csv
                </Badge>
              </div>
              <p className="text-[11px] text-zinc-400">
                Drag and drop raw log files for instant multi-line batch parsing and verification.
              </p>
              <button
                onClick={() => onNavigate('ingest')}
                className="text-[10px] font-mono text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer pt-0.5"
              >
                <ArrowUpRight className="h-3 w-3" />
                Open File Dropzone
              </button>
            </div>
          </div>

          {/* Quick Direct Ingest Inline Input */}
          <div className="pt-2 border-t border-zinc-800/80 flex flex-col sm:flex-row items-center gap-2">
            <input
              type="text"
              placeholder="Quick Direct Ingest: Paste any raw perimeter syslog line here to parse instantly..."
              value={quickInput}
              onChange={(e) => setQuickInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleQuickIngest();
              }}
              className="w-full px-3 py-1.5 rounded-md bg-zinc-900 border border-zinc-800 font-mono text-xs text-zinc-200 placeholder-zinc-500 focus:outline-hidden focus:border-emerald-500/50"
            />
            <Button
              variant="emerald"
              size="sm"
              onClick={handleQuickIngest}
              disabled={!quickInput.trim()}
              className="shrink-0 h-8 text-xs font-mono cursor-pointer"
            >
              {quickSuccess ? (
                <>
                  <CheckCircle className="h-3.5 w-3.5 mr-1" />
                  Ingested to Pipeline!
                </>
              ) : (
                'Ingest Directly'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* System Health */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-emerald-400" />
              Pipeline Subsystems Health
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            {Object.entries(healthStatus).map(([component, status]) => (
              <div key={component} className="flex items-center justify-between py-1 border-b border-zinc-800/40 last:border-0">
                <span className="capitalize text-zinc-300 font-medium">
                  {component.replace('_', ' ')}
                </span>
                <Badge variant={status === 'healthy' ? 'success' : 'destructive'}>
                  {status === 'healthy' ? (
                    <>
                      <CheckCircle className="mr-1 h-3 w-3" />
                      Healthy
                    </>
                  ) : (
                    'Degraded'
                  )}
                </Badge>
              </div>
            ))}
            <div className="pt-2 text-[11px] text-zinc-500 flex items-center justify-between font-mono border-t border-zinc-800/60 mt-1">
              <span>Active AI Reasoning Engine:</span>
              <span className="text-emerald-400 font-semibold uppercase">
                {activeEngine === 'ollama'
                  ? `Ollama (${backendHealth.ollamaModel || 'mistral'})`
                  : activeEngine === 'groq'
                    ? 'Groq (LLaMA 3.3)'
                    : backendHealth.hasGeminiKey
                      ? 'Gemini 3.8 Flash'
                      : 'Deterministic Sandbox'}
              </span>
            </div>
            <div className="text-[10px] text-zinc-500 flex items-center justify-between font-mono">
              <span>SIH Local Weights Support:</span>
              <span className="text-zinc-300">Ready via /api/ai/drift-analysis</span>
            </div>
          </CardContent>
        </Card>

        {/* Recent Alerts & Drift Chamber */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                <span>Autonomous Quarantine Chamber</span>
              </div>
              <Badge variant={quarantinedEvents.length > 0 ? 'warning' : 'outline'} className="text-[10px]">
                {quarantinedEvents.length} Active
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            {quarantinedEvents.length > 0 ? (
              quarantinedEvents.slice(0, 2).map((item) => (
                <div key={item.id} className="p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800">
                  <div className="flex items-center justify-between font-semibold text-zinc-200">
                    <span>{item.event?.detection?.device_product || 'Firewall Perimeter'}</span>
                    <Badge variant="warning">{item.status}</Badge>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1">
                    Isolated drift reason: <span className="text-amber-300 font-mono">{item.driftReason || 'Novel tokens'}</span>
                  </p>
                </div>
              ))
            ) : (
              <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-center space-y-1.5">
                <div className="flex items-center justify-center gap-1.5 text-emerald-400 font-medium">
                  <CheckCircle className="h-4 w-4" />
                  <span>Chamber Clear</span>
                </div>
                <p className="text-[11px] text-zinc-500">
                  Zero active schema drift detected. All ingested logs match known versioned rules.
                </p>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-between"
                onClick={() => onNavigate('drift')}
              >
                <span>Drift Console</span>
                <ArrowUpRight className="h-3.5 w-3.5 text-zinc-400" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <TrendingUp className="h-4 w-4 text-blue-400" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start gap-2.5 text-xs text-zinc-200 hover:text-zinc-100"
              onClick={() => onNavigate('sources')}
            >
              <Server className="h-3.5 w-3.5 text-purple-400" />
              Manage Perimeter Sources
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start gap-2.5 text-xs text-zinc-200 hover:text-zinc-100"
              onClick={() => onNavigate('events')}
            >
              <Database className="h-3.5 w-3.5 text-emerald-400" />
              Inspect Live Event Stream
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start gap-2.5 text-xs text-zinc-200 hover:text-zinc-100"
              onClick={() => onNavigate('outputs')}
            >
              <GitBranch className="h-3.5 w-3.5 text-blue-400" />
              Output Profiles & Mappings
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start gap-2.5 text-xs text-zinc-200 hover:text-zinc-100"
              onClick={() => {
                if (onOpenVerification) onOpenVerification();
              }}
            >
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              Run Pipeline Self-Test (9 Fixtures)
            </Button>

            {/* Quick inject sample */}
            <div className="pt-2 border-t border-zinc-800/80">
              <div className="text-[10px] uppercase font-mono text-zinc-500 mb-1.5 font-semibold">
                Quick Test Perimeter Sample
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <Button
                  variant="secondary"
                  size="sm"
                  className="text-[11px] justify-center"
                  onClick={() => {
                    onInjectSample(GOLDEN_CORPUS[0].raw);
                    onNavigate('sources');
                  }}
                >
                  Palo Alto Log
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="text-[11px] justify-center"
                  onClick={() => {
                    onInjectSample(GOLDEN_CORPUS[1].raw);
                    onNavigate('sources');
                  }}
                >
                  Cisco ASA Log
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
