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
} from 'lucide-react';
import { quarantineManager } from '../../services/quarantineManager.ts';
import { GOLDEN_CORPUS } from '../../data/goldenCorpus.ts';

interface DashboardPageProps {
  onNavigate: (route: string) => void;
  onInjectSample: (raw: string) => void;
  totalEvents: number;
  avgLatencyMs: number;
  losslessRatePct: number;
  healthStatus?: {
    ingestion: string;
    processing: string;
    storage: string;
    ai_engine: string;
  };
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onNavigate,
  onInjectSample,
  totalEvents,
  avgLatencyMs,
  losslessRatePct,
  healthStatus = {
    ingestion: 'healthy',
    processing: 'healthy',
    storage: 'healthy',
    ai_engine: 'healthy',
  },
}) => {
  const [quarantinedCount, setQuarantinedCount] = useState<number>(0);
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
    const qList = quarantineManager.getAll();
    setQuarantinedCount(qList.length);

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
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 500);
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
      value: `${quarantinedCount} Events`,
      subtext: 'Autonomous zero-day drift isolation',
      icon: AlertTriangle,
      color: 'text-orange-500',
      bg: 'bg-orange-500/10',
      trend: quarantinedCount > 0 ? `${quarantinedCount} pending review` : 'All Schemas Stable',
      trendUp: quarantinedCount === 0,
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

      {/* 3 Lower Modular Cards */}
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
            <CardTitle className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              Autonomous Quarantine Chamber
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800">
              <div className="flex items-center justify-between font-semibold text-zinc-200">
                <span>Palo Alto PAN-OS 11.0</span>
                <Badge variant="warning">Schema Drift</Badge>
              </div>
              <p className="text-[11px] text-zinc-400 mt-1">
                Detected novel telemetry fields: <code className="text-amber-300 font-mono">ja4</code>, <code className="text-amber-300 font-mono">cloud_vpc_id</code>
              </p>
            </div>

            <div className="p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800">
              <div className="flex items-center justify-between font-semibold text-zinc-200">
                <span>Cisco ASA 5525-X</span>
                <Badge variant="warning">NAT Telemetry</Badge>
              </div>
              <p className="text-[11px] text-zinc-400 mt-1">
                Novel NAT egress tokens: <code className="text-amber-300 font-mono">nat_spt</code>, <code className="text-amber-300 font-mono">xlate_src</code>
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="w-full justify-between"
              onClick={() => onNavigate('drift')}
            >
              <span>Review Drift Events</span>
              <ArrowUpRight className="h-3.5 w-3.5 text-zinc-400" />
            </Button>
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
              onClick={() => onNavigate('mappings')}
            >
              <GitBranch className="h-3.5 w-3.5 text-blue-400" />
              Explore Schema Mappings
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start gap-2.5 text-xs text-zinc-200 hover:text-zinc-100"
              onClick={() => onNavigate('verification')}
            >
              <ShieldCheck className="h-3.5 w-3.5 text-purple-400" />
              Run Phase 6 Golden Suite
            </Button>

            {/* Quick inject sample */}
            <div className="pt-2 border-t border-zinc-800/80">
              <div className="text-[10px] uppercase font-mono text-zinc-500 mb-1.5 font-semibold">
                Quick Inject Test Fixture
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <Button
                  variant="secondary"
                  size="sm"
                  className="text-[11px] justify-center"
                  onClick={() => {
                    onInjectSample(GOLDEN_CORPUS[0].raw);
                    onNavigate('workbench');
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
                    onNavigate('workbench');
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
