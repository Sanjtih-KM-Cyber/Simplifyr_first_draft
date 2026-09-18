/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card.tsx';
import { Button } from '../ui/button.tsx';
import { Textarea } from '../ui/textarea.tsx';
import { Badge } from '../ui/badge.tsx';
import {
  UploadCloud,
  Terminal,
  FileText,
  CheckCircle,
  AlertCircle,
  X,
  Play,
  Zap,
} from 'lucide-react';
import { processRawEventThroughPipeline } from '../../services/streamSimulator.ts';
import { ProcessedStreamEvent } from '../../types.ts';

interface IngestLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEventsIngested: (newEvents: ProcessedStreamEvent[]) => void;
}

export const IngestLogsModal: React.FC<IngestLogsModalProps> = ({
  isOpen,
  onClose,
  onEventsIngested,
}) => {
  const [rawText, setRawText] = useState('');
  const [ingestMode, setIngestMode] = useState<'text' | 'file' | 'curl'>('text');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleProcessRaw = async () => {
    const lines = rawText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) {
      setStatusMessage({ type: 'error', text: 'Please enter at least one log line to ingest.' });
      return;
    }

    setIsProcessing(true);
    setStatusMessage(null);

    try {
      // 1. Process directly through pipeline in memory for instant verification
      const processed: ProcessedStreamEvent[] = [];
      for (const line of lines) {
        const ev = processRawEventThroughPipeline(line);
        processed.push(ev);
      }

      // 2. Also submit to backend ingestion webhook /api/ingest
      fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logs: lines,
          source_id: 'manual-workbench-ingest',
        }),
      }).catch(() => {
        // Backend optional in offline air-gapped run
      });

      onEventsIngested(processed);
      setStatusMessage({
        type: 'success',
        text: `Successfully ingested and parsed ${processed.length} perimeter log events through ULPF!`,
      });
      setRawText('');
      setTimeout(() => {
        onClose();
        setStatusMessage(null);
      }, 1200);
    } catch (err: unknown) {
      setStatusMessage({
        type: 'error',
        text: `Ingestion error: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setRawText(content);
      setIngestMode('text');
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-zinc-950/40">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <UploadCloud className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-100">Live Ingest Telemetry</h2>
              <p className="text-xs text-zinc-400">
                Feed actual production perimeter logs (Syslog, CEF, LEEF, JSON, KV) into ULPF
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="flex items-center gap-2 px-5 pt-3 border-b border-zinc-800/80 bg-zinc-900/50">
          <button
            onClick={() => setIngestMode('text')}
            className={`pb-2.5 px-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              ingestMode === 'text'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <FileText className="h-3.5 w-3.5" /> Direct Paste / Text
          </button>
          <button
            onClick={() => setIngestMode('file')}
            className={`pb-2.5 px-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              ingestMode === 'file'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <UploadCloud className="h-3.5 w-3.5" /> Upload File (.log / .txt)
          </button>
          <button
            onClick={() => setIngestMode('curl')}
            className={`pb-2.5 px-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              ingestMode === 'curl'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Terminal className="h-3.5 w-3.5" /> cURL / Production Webhook
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {ingestMode === 'text' && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-300 flex items-center justify-between">
                <span>Raw Log Records (one per line):</span>
                <span className="text-[11px] text-zinc-500">Supports Palo Alto, Fortinet, Cisco, Snort, Checkpoint</span>
              </label>
              <Textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder={`Paste actual firewall logs here, e.g.:
CEF:0|Palo Alto Networks|PAN-OS|10.1.0|TRAFFIC|drop|1|src=198.51.100.4 dst=10.0.0.15 spt=52411 dpt=443 proto=tcp act=deny
date=2026-03-29 time=14:22:01 devname="FG-100D" type="traffic" subtype="forward" action="close" srcip=192.168.1.50 dstip=8.8.8.8
{"timestamp":"2026-03-29T14:22:01Z","vendor":"cisco_asa","action":"built","src_ip":"10.0.1.20","dst_ip":"172.16.0.4"}`}
                className="font-mono text-xs h-48 bg-zinc-950 border-zinc-800 text-zinc-200 focus:border-emerald-500"
              />
            </div>
          )}

          {ingestMode === 'file' && (
            <div className="border-2 border-dashed border-zinc-700 rounded-xl p-8 text-center hover:border-emerald-500/50 transition-colors">
              <UploadCloud className="h-10 w-10 text-zinc-500 mx-auto mb-3" />
              <p className="text-sm font-medium text-zinc-200 mb-1">Select real log capture or drop file</p>
              <p className="text-xs text-zinc-500 mb-4">Supports .log, .txt, .csv, .json export files from SIEMs or firewalls</p>
              <label className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-medium cursor-pointer transition-colors border border-zinc-700">
                Browse System Files
                <input
                  type="file"
                  accept=".log,.txt,.csv,.json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          )}

          {ingestMode === 'curl' && (
            <div className="space-y-3">
              <p className="text-xs text-zinc-300">
                You can push raw logs directly to this server from Rsyslog, Syslog-ng, FluentBit, Logstash, or Python scripts:
              </p>
              <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-[11px] text-emerald-400 overflow-x-auto select-all">
                curl -X POST http://localhost:3000/api/ingest \<br />
                &nbsp;&nbsp;-H "Content-Type: application/json" \<br />
                &nbsp;&nbsp;-d '{`{"raw":"CEF:0|Palo Alto Networks|PAN-OS|10.1.0|TRAFFIC|drop|1|src=1.2.3.4 dst=5.6.7.8"}`}'
              </div>
              <p className="text-[11px] text-zinc-500">
                External Syslog collectors can forward TCP/UDP logs directly into the ingestion webhook endpoint.
              </p>
            </div>
          )}

          {statusMessage && (
            <div
              className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                  : 'bg-red-950/40 border-red-800 text-red-300'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-800 bg-zinc-950/40">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="emerald"
            size="sm"
            onClick={handleProcessRaw}
            disabled={isProcessing || !rawText.trim()}
          >
            {isProcessing ? (
              'Processing Pipeline...'
            ) : (
              <>
                <Zap className="mr-1.5 h-3.5 w-3.5" />
                Ingest & Process Logs
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
