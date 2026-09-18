/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventProvenance, FieldProvenance, LogFormat, PerimeterVendor } from '../types.ts';

/**
 * Creates an empty EventProvenance container.
 */
export function createEventProvenance(
  eventId: string,
  sha256Hash: string,
  sourceDevice: string,
  detectedFormat: LogFormat,
  detectedVendor: PerimeterVendor,
  parserVersion: string,
  mappingVersion: string,
  latencyMs: number = 0
): EventProvenance {
  return {
    event_id: eventId,
    sha256_hash: sha256Hash,
    source_device: sourceDevice,
    detected_format: detectedFormat,
    detected_vendor: detectedVendor,
    parser_version: parserVersion,
    mapping_version: mappingVersion,
    lineage: {},
    processed_at: new Date().toISOString(),
    latency_ms: latencyMs,
  };
}

/**
 * Records a single field's lineage for forensic traceability.
 */
export function recordFieldLineage(
  provenance: EventProvenance,
  outputField: string,
  outputValue: unknown,
  originalField: string,
  originalValue: unknown,
  mappingRule: string,
  mappingVersion: string,
  confidence: number,
  rawSlice?: { start: number; end: number }
): void {
  const record: FieldProvenance = {
    output_field: outputField,
    output_value: outputValue,
    original_field: originalField,
    original_value: originalValue,
    mapping_rule: mappingRule,
    mapping_version: mappingVersion,
    confidence,
    raw_slice: rawSlice,
  };

  provenance.lineage[outputField] = record;
}
