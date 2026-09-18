/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ProcessedStreamEvent,
  QuarantinedEvent,
  QuarantineStatus,
  ReprocessResult,
  SuggestedRulePatch,
} from '../types.ts';
import { driftEngine } from './driftEngine.ts';

type QuarantineListener = (events: QuarantinedEvent[]) => void;

class QuarantineBufferManager {
  private events: QuarantinedEvent[] = [];
  private listeners: QuarantineListener[] = [];

  public subscribe(listener: QuarantineListener): () => void {
    this.listeners.push(listener);
    listener([...this.events]);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    const copy = [...this.events];
    this.listeners.forEach((l) => l(copy));
  }

  public getAll(): QuarantinedEvent[] {
    return [...this.events];
  }

  public getById(id: string): QuarantinedEvent | undefined {
    return this.events.find((e) => e.id === id);
  }

  public get(id: string): QuarantinedEvent | undefined {
    return this.events.find((e) => e.id === id || e.event.id === id);
  }

  public quarantine(event: ProcessedStreamEvent, reason?: string): QuarantinedEvent {
    const existing = this.events.find((e) => e.event.id === event.id);
    if (existing) {
      if (reason) existing.quarantineReason = reason;
      return existing;
    }
    return this.addEventFromStream({
      ...event,
      driftReason: reason || event.driftReason,
      isDrift: true,
    });
  }

  public addEventFromStream(event: ProcessedStreamEvent): QuarantinedEvent {
    // Check if already in quarantine
    const existing = this.events.find((e) => e.event.id === event.id);
    if (existing) return existing;

    const extracted = event.parsed.fields;
    const unmapped = event.unmappedFields;

    const fingerprint = driftEngine.computeFingerprint(
      event.detection.vendor,
      event.detection.format,
      event.mapping.software_version,
      extracted,
      event.raw
    );

    const diffResult = driftEngine.diffAgainstBaseMapping(
      fingerprint,
      unmapped,
      extracted,
      event.mapping
    );

    const quarantined: QuarantinedEvent = {
      id: `quar_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      quarantinedAt: new Date().toISOString(),
      event,
      status: 'QUARANTINED',
      quarantineReason: event.driftReason || `Drift detected: ${Object.keys(unmapped).length} unmapped field(s)`,
      fingerprint,
      diffResult,
    };

    this.events.unshift(quarantined);
    this.notify();
    return quarantined;
  }

  public updateStatus(id: string, status: QuarantineStatus) {
    const item = this.getById(id);
    if (item) {
      item.status = status;
      this.notify();
    }
  }

  public attachAiAnalysis(id: string, analysis: QuarantinedEvent['aiAnalysis']) {
    const item = this.getById(id);
    if (item) {
      item.aiAnalysis = analysis;
      item.status = 'PATCH_READY';
      this.notify();
    }
  }

  public reprocess(
    id: string,
    approvedPatches: SuggestedRulePatch[],
    targetVersion: string,
    approvedBy: string,
    notes?: string
  ): ReprocessResult {
    const item = this.getById(id);
    if (!item) throw new Error(`Quarantined event ${id} not found`);

    const result = driftEngine.reprocessQuarantinedEvent(
      item,
      approvedPatches,
      targetVersion,
      approvedBy,
      notes
    );

    item.status = 'REPROCESSED';
    item.reprocessedEvent = result.reprocessedEvent;
    item.reprocessedAt = result.reprocessedAt;
    item.appliedPatchVersion = result.appliedVersion;
    item.reprocessNotes = result.message;

    this.notify();
    return result;
  }

  public reprocessBatch(
    ids: string[],
    approvedPatches: SuggestedRulePatch[],
    targetVersion: string,
    approvedBy: string
  ): ReprocessResult[] {
    return ids.map((id) => this.reprocess(id, approvedPatches, targetVersion, approvedBy));
  }

  public discard(id: string) {
    const item = this.getById(id);
    if (item) {
      item.status = 'DISCARDED';
      this.notify();
    }
  }

  public clearResolved() {
    this.events = this.events.filter((e) => e.status !== 'REPROCESSED' && e.status !== 'DISCARDED');
    this.notify();
  }
}

export const quarantineManager = new QuarantineBufferManager();
