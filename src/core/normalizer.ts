/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CanonicalSemanticEvent,
  CommonEventEnvelope,
  EventProvenance,
  ParsedEvent,
  VersionedMapping,
} from '../types.ts';
import { createEventProvenance, recordFieldLineage } from './provenance.ts';

export interface NormalizationResult {
  canonical: CanonicalSemanticEvent;
  provenance: EventProvenance;
  matchedMapping: VersionedMapping;
  mappedCount: number;
  unmappedFields: Record<string, unknown>;
  warnings: string[];
}

/**
 * Standardizes common network actions to our canonical enum:
 * 'ALLOWED' | 'BLOCKED' | 'ALERT' | 'UNKNOWN'
 */
export function normalizeAction(val: unknown): 'ALLOWED' | 'BLOCKED' | 'ALERT' | 'UNKNOWN' {
  if (!val) return 'UNKNOWN';
  const s = String(val).trim().toUpperCase();
  if (['ALLOW', 'PERMIT', 'PASS', 'ACCEPT', 'BUILT', 'OPEN', 'ALLOWED'].includes(s)) {
    return 'ALLOWED';
  }
  if (
    [
      'DENY',
      'DROP',
      'BLOCK',
      'REJECT',
      'BLOCKED',
      'DISCARD',
      'TEARDOWN',
      'RESET-CLIENT',
      'RESET-SERVER',
      'RESET-BOTH',
    ].includes(s)
  ) {
    return 'BLOCKED';
  }
  if (['ALERT', 'WARN', 'WARNING', 'DETECT', 'DETECTED', 'ATTACK'].includes(s)) {
    return 'ALERT';
  }
  return 'UNKNOWN';
}

/**
 * Standardizes common protocols to canonical:
 * 'TCP' | 'UDP' | 'ICMP' | 'GRE' | 'OTHER'
 */
export function normalizeProtocol(val: unknown): 'TCP' | 'UDP' | 'ICMP' | 'GRE' | 'OTHER' {
  if (!val) return 'OTHER';
  const s = String(val).trim().toUpperCase().replace(/[{}]/g, '');
  if (s === '6' || s === 'TCP') return 'TCP';
  if (s === '17' || s === 'UDP') return 'UDP';
  if (s === '1' || s === 'ICMP') return 'ICMP';
  if (s === '47' || s === 'GRE') return 'GRE';
  return 'OTHER';
}

/**
 * Standardizes common severity levels to canonical:
 * 'INFORMATIONAL' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
 */
export function normalizeSeverity(
  val: unknown
): 'INFORMATIONAL' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  if (val === undefined || val === null) return 'INFORMATIONAL';
  const s = String(val).trim().toUpperCase();
  if (['CRITICAL', 'EMERGENCY', 'ALERT', '0', '1', 'FATAL'].includes(s)) return 'CRITICAL';
  if (['HIGH', 'ERROR', 'ERR', '2', '3'].includes(s)) return 'HIGH';
  if (['MEDIUM', 'MED', 'WARNING', 'WARN', '4'].includes(s)) return 'MEDIUM';
  if (['LOW', 'NOTICE', '5'].includes(s)) return 'LOW';
  return 'INFORMATIONAL';
}

/**
 * Canonical Semantic Normalizer
 * Pure deterministic engine executing versioned mapping rules.
 */
export function normalizeEvent(
  envelope: CommonEventEnvelope,
  parsed: ParsedEvent,
  mapping: VersionedMapping,
  latencyMs: number = 0.15
): NormalizationResult {
  const warnings: string[] = [];
  const provenance = createEventProvenance(
    envelope.event_id,
    envelope.sha256_hash,
    envelope.ingestion_source.device_id,
    parsed.format,
    mapping.vendor,
    `${parsed.parser_name}@${parsed.parser_version}`,
    `${mapping.mapping_id}@${mapping.software_version}`,
    latencyMs
  );

  // Initialize canonical structure
  const canonical: CanonicalSemanticEvent = {
    event_id: envelope.event_id,
    timestamp: parsed.header.timestamp || envelope.received_at,
    device: {
      vendor: mapping.vendor,
      product: mapping.product,
      version: mapping.software_version,
      hostname: parsed.header.hostname || envelope.ingestion_source.device_id,
      device_id: envelope.ingestion_source.device_id,
    },
    source: {
      ip: '',
    },
    destination: {
      ip: '',
    },
    network: {
      protocol: 'OTHER',
      action: 'UNKNOWN',
    },
  };

  const matchedInputFields = new Set<string>();

  // Helper to extract value from parsed fields or header
  const getFieldValue = (fieldPath: string): unknown => {
    if (fieldPath.startsWith('syslog.') || fieldPath.startsWith('cef.')) {
      const sub = fieldPath.split('.')[1];
      if (sub === 'severity') return parsed.header.severity;
      if (sub === 'priority') return parsed.header.priority;
      if (sub === 'facility') return parsed.header.facility;
      if (sub === 'hostname') return parsed.header.hostname;
    }
    if (fieldPath in parsed.fields) {
      return parsed.fields[fieldPath];
    }
    // Case-insensitive fallback
    const lower = fieldPath.toLowerCase();
    for (const [k, v] of Object.entries(parsed.fields)) {
      if (k.toLowerCase() === lower) return v;
    }
    return undefined;
  };

  let mappedCount = 0;

  // Execute rules from the versioned mapping
  for (const rule of mapping.rules) {
    const rawVal = getFieldValue(rule.input_field);
    if (rawVal === undefined || rawVal === null || rawVal === '') {
      continue;
    }

    matchedInputFields.add(rule.input_field);
    let outputVal: unknown = rawVal;

    // Apply transformation
    if (rule.transformation_type === 'identity') {
      outputVal = String(rawVal);
    } else if (rule.transformation_type === 'cast') {
      const num = Number(rawVal);
      outputVal = Number.isNaN(num) ? rawVal : num;
    } else if (rule.transformation_type === 'enum') {
      if (rule.enum_map) {
        const key = String(rawVal);
        outputVal =
          rule.enum_map[key] ||
          rule.enum_map[key.toLowerCase()] ||
          rule.enum_map[key.toUpperCase()] ||
          rawVal;
      }
    }

    // Assign to canonical tree based on semantic_field path
    switch (rule.semantic_field) {
      case 'source.ip':
        canonical.source.ip = String(outputVal);
        break;
      case 'source.port':
        canonical.source.port = typeof outputVal === 'number' ? outputVal : Number(outputVal);
        break;
      case 'source.zone':
        canonical.source.zone = String(outputVal);
        break;
      case 'source.nat_ip':
        canonical.source.nat_ip = String(outputVal);
        break;
      case 'source.nat_port':
        canonical.source.nat_port = typeof outputVal === 'number' ? outputVal : Number(outputVal);
        break;
      case 'destination.ip':
        canonical.destination.ip = String(outputVal);
        break;
      case 'destination.port':
        canonical.destination.port =
          typeof outputVal === 'number' ? outputVal : Number(outputVal);
        break;
      case 'destination.zone':
        canonical.destination.zone = String(outputVal);
        break;
      case 'destination.nat_ip':
        canonical.destination.nat_ip = String(outputVal);
        break;
      case 'destination.nat_port':
        canonical.destination.nat_port =
          typeof outputVal === 'number' ? outputVal : Number(outputVal);
        break;
      case 'network.protocol':
        canonical.network.protocol = normalizeProtocol(outputVal);
        outputVal = canonical.network.protocol;
        break;
      case 'network.action':
        canonical.network.action = normalizeAction(outputVal);
        outputVal = canonical.network.action;
        break;
      case 'network.bytes_in':
        canonical.network.bytes_in =
          typeof outputVal === 'number' ? outputVal : Number(outputVal);
        break;
      case 'network.bytes_out':
        canonical.network.bytes_out =
          typeof outputVal === 'number' ? outputVal : Number(outputVal);
        break;
      case 'network.packets':
        canonical.network.packets =
          typeof outputVal === 'number' ? outputVal : Number(outputVal);
        break;
      case 'network.session_id':
        canonical.network.session_id = String(outputVal);
        break;
      case 'network.application':
        canonical.network.application = String(outputVal);
        break;
      case 'threat.severity':
        if (!canonical.threat) canonical.threat = { severity: 'INFORMATIONAL' };
        canonical.threat.severity = normalizeSeverity(outputVal);
        outputVal = canonical.threat.severity;
        break;
      case 'threat.signature':
        if (!canonical.threat) canonical.threat = { severity: 'INFORMATIONAL' };
        canonical.threat.signature = String(outputVal);
        break;
      case 'threat.category':
        if (!canonical.threat) canonical.threat = { severity: 'INFORMATIONAL' };
        canonical.threat.category = String(outputVal);
        break;
      case 'threat.cve':
        if (!canonical.threat) canonical.threat = { severity: 'INFORMATIONAL' };
        canonical.threat.cve = String(outputVal);
        break;
      case 'auth.user':
        if (!canonical.auth) canonical.auth = {};
        canonical.auth.user = String(outputVal);
        break;
      default:
        // Set in metadata
        if (!canonical.metadata) canonical.metadata = {};
        canonical.metadata[rule.semantic_field] = outputVal;
        break;
    }

    mappedCount++;

    // Find raw slice if token exists, or calculate slice from envelope raw_payload
    const matchingToken = parsed.raw_tokens.find(
      (t) => t.key === rule.input_field || t.value === String(rawVal)
    );

    let resolvedSlice = matchingToken?.raw_slice;
    if (!resolvedSlice && envelope.raw_payload && rawVal !== undefined && rawVal !== null && rawVal !== '') {
      const rawStr = String(rawVal);
      // First try to find key=value pattern
      const kvPattern = `${rule.input_field}=${rawStr}`;
      const kvIdx = envelope.raw_payload.indexOf(kvPattern);
      if (kvIdx !== -1) {
        resolvedSlice = { start: kvIdx + rule.input_field.length + 1, end: kvIdx + kvPattern.length };
      } else {
        // Fallback to finding raw string
        const idx = envelope.raw_payload.indexOf(rawStr);
        if (idx !== -1) {
          resolvedSlice = { start: idx, end: idx + rawStr.length };
        }
      }
    }

    // Record forensic lineage
    recordFieldLineage(
      provenance,
      rule.semantic_field,
      outputVal,
      rule.input_field,
      rawVal,
      rule.transformation_type,
      mapping.software_version,
      rule.confidence,
      resolvedSlice
    );
  }

  // Identify unmapped fields
  const unmappedFields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parsed.fields)) {
    if (!matchedInputFields.has(key)) {
      unmappedFields[key] = value;
    }
  }

  if (!canonical.source.ip && parsed.fields.src) {
    canonical.source.ip = String(parsed.fields.src);
  }
  if (!canonical.destination.ip && parsed.fields.dst) {
    canonical.destination.ip = String(parsed.fields.dst);
  }

  return {
    canonical,
    provenance,
    matchedMapping: mapping,
    mappedCount,
    unmappedFields,
    warnings,
  };
}
