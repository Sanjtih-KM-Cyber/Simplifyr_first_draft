/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, Sparkles, Terminal, Check, ArrowRight } from 'lucide-react';
import { Button } from '../ui/button.tsx';
import { ProcessedStreamEvent } from '../../types.ts';
import { processRawEventThroughPipeline } from '../../services/streamSimulator.ts';

interface IngestDropzoneProps {
  onEventsIngested: (events: ProcessedStreamEvent[]) => void;
  onInjectSinglePulse?: () => void;
}

const SAMPLE_LOGS = [
  {
    name: 'Palo Alto PAN-OS',
    raw: '<14>1 2026-09-18T10:14:02.000Z pa-fw-core-01 PAN-OS - - [pan@2847 src=192.168.4.88 dst=104.244.42.1 spt=54120 dpt=443 proto=tcp act=allow bytes=4210 pkts=18]',
  },
  {
    name: 'Cisco ASA Teardown',
    raw: 'Sep 18 10:16:45 cisco-asa-edge %ASA-6-302014: Teardown TCP connection 9821415 for outside:198.51.100.22/443 to inside:10.10.5.21/49812 duration 0:02:14 bytes 8920 TCP FINs',
  },
  {
    name: 'Fortinet FortiGate',
    raw: 'date=2026-09-18 time=10:18:22 devname="FGT-EDGE-HQ" logid="0000000013" type="traffic" subtype="forward" level="notice" srcip=10.1.10.42 srcport=51294 dstip=172.217.16.206 dstport=443 proto=6 action="accept" sentbyte=2410 rcvdbyte=8120',
  },
];

export const IngestDropzone: React.FC<IngestDropzoneProps> = ({
  onEventsIngested,
  onInjectSinglePulse,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [quickInput, setQuickInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processText = (text: string) => {
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) return;

    setIsProcessing(true);
    try {
      const processed: ProcessedStreamEvent[] = [];
      for (const line of lines) {
        const ev = processRawEventThroughPipeline(line);
        processed.push(ev);
      }
      onEventsIngested(processed);
      setSuccessCount(processed.length);
      setQuickInput('');
      setTimeout(() => setSuccessCount(null), 2500);
    } catch (err) {
      console.error('Ingestion error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        if (content) processText(content);
      };
      reader.readAsText(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        if (content) processText(content);
      };
      reader.readAsText(file);
    }
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={`rounded-xl border transition-all p-3.5 bg-zinc-950/80 ${
        isDragging
          ? 'border-emerald-500 bg-emerald-950/10 shadow-lg shadow-emerald-500/5 ring-1 ring-emerald-500/30'
          : 'border-zinc-800/90 hover:border-zinc-700/80'
      }`}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept=".log,.txt,.json,.csv"
        className="hidden"
      />

      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
        {/* Dropzone Trigger */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-3 px-3 py-2 rounded-lg bg-zinc-900/60 border border-zinc-800 hover:border-emerald-500/40 hover:bg-zinc-900 transition-colors cursor-pointer shrink-0 select-none group"
        >
          <div className="w-8 h-8 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
            <UploadCloud className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-semibold text-zinc-200 group-hover:text-emerald-400 transition-colors flex items-center gap-1.5">
              <span>Drop log file here</span>
              <span className="text-[10px] text-zinc-500 font-normal">or click to browse</span>
            </div>
            <p className="text-[10px] font-mono text-zinc-400">.log, .txt, .json supported</p>
          </div>
        </div>

        {/* Inline Quick Paste input */}
        <div className="flex-1 flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={quickInput}
              onChange={(e) => setQuickInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') processText(quickInput);
              }}
              placeholder="Or paste any raw log line directly here and press Enter..."
              className="w-full h-9 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 font-mono placeholder:text-zinc-500 focus:outline-hidden focus:border-emerald-500/50"
            />
          </div>

          <Button
            variant="emerald"
            size="sm"
            onClick={() => processText(quickInput)}
            disabled={!quickInput.trim() || isProcessing}
            className="h-9 px-3 text-xs"
          >
            {successCount ? (
              <>
                <Check className="w-3.5 h-3.5 mr-1" />
                Ingested {successCount}!
              </>
            ) : (
              <>
                <span>Ingest</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </>
            )}
          </Button>
        </div>

        {/* Quick Sample Injections */}
        <div className="hidden xl:flex items-center gap-1.5 shrink-0 border-l border-zinc-800 pl-3">
          <span className="text-[10px] font-mono uppercase text-zinc-500">Quick Test:</span>
          {SAMPLE_LOGS.map((s) => (
            <button
              key={s.name}
              onClick={() => processText(s.raw)}
              className="px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[10px] font-mono text-zinc-300 hover:text-emerald-400 transition-colors cursor-pointer"
              title={s.raw}
            >
              + {s.name.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
