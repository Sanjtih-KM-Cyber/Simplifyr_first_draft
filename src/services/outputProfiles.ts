/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CanonicalSemanticEvent, OutputProfile } from '../types.ts';

export const PRESET_OUTPUT_PROFILES: OutputProfile[] = [
  // 1. SOC Alert Triage (Tier 1)
  {
    id: 'soc_triage',
    name: 'SOC Alert Triage (Tier 1)',
    description: 'High-signal analyst view for rapid disposition: verdict, threat severity, alert signature, and 5-tuple.',
    is_preset: true,
    format: 'json',
    fields_to_include: [
      'timestamp',
      'network.action',
      'threat.severity',
      'threat.signature',
      'source.ip',
      'source.port',
      'destination.ip',
      'destination.port',
      'network.protocol',
      'device.product',
      'device.hostname',
    ],
    key_rename_map: {
      'timestamp': 'timestamp',
      'network.action': 'verdict',
      'threat.severity': 'severity',
      'threat.signature': 'alert_signature',
      'source.ip': 'src_ip',
      'source.port': 'src_port',
      'destination.ip': 'dst_ip',
      'destination.port': 'dst_port',
      'network.protocol': 'protocol',
      'device.product': 'device_product',
      'device.hostname': 'device_host',
    },
  },

  // 2. SOC Incident Investigation & Deep Hunt (Tier 2/3)
  {
    id: 'soc_investigation',
    name: 'SOC Incident Response & Deep Hunt',
    description: 'Deep investigative context: full session tracking, NAT translations, threat metadata, and cryptographic SHA-256 seal.',
    is_preset: true,
    format: 'json',
    fields_to_include: [
      'event_id',
      'timestamp',
      'threat.severity',
      'threat.signature',
      'network.action',
      'network.protocol',
      'network.application',
      'network.session_id',
      'source.ip',
      'source.port',
      'source.zone',
      'source.nat_ip',
      'source.nat_port',
      'destination.ip',
      'destination.port',
      'destination.zone',
      'network.bytes_in',
      'network.bytes_out',
      'device.vendor',
      'device.product',
      'device.hostname',
      'metadata.sha256_hash',
    ],
    key_rename_map: {
      'threat.severity': 'severity',
      'threat.signature': 'alert_name',
      'network.action': 'firewall_action',
      'network.protocol': 'protocol',
      'source.ip': 'src_ip',
      'source.port': 'src_port',
      'destination.ip': 'dest_ip',
      'destination.port': 'dest_port',
    },
  },

  // 3. SOC Threat Intel & IOC Matching
  {
    id: 'soc_threat_intel',
    name: 'SOC Threat Intel & IOC Matching',
    description: 'Extracted network observables and indicators for TIP/MISP/OpenCTI correlation and threat hunting.',
    is_preset: true,
    format: 'json',
    fields_to_include: [
      'timestamp',
      'source.ip',
      'destination.ip',
      'destination.port',
      'network.application',
      'network.protocol',
      'threat.severity',
      'threat.signature',
      'network.action',
      'device.hostname',
      'metadata.sha256_hash',
    ],
    key_rename_map: {
      'source.ip': 'observable_src_ip',
      'destination.ip': 'observable_dst_ip',
      'destination.port': 'observable_port',
      'network.application': 'observable_app',
      'threat.signature': 'matched_ioc',
      'network.action': 'enforcement_verdict',
      'metadata.sha256_hash': 'source_evidence_sha256',
    },
  },

  // 4. SOC AI/ML Anomaly Feature Vector
  {
    id: 'soc_ml_analytics',
    name: 'SOC AI/ML Behavioral Anomaly Vector',
    description: 'Flat numerical and categorical feature vector optimized for isolation forests, clustering, and behavioral ML models.',
    is_preset: true,
    format: 'flat_json',
    fields_to_include: [
      'source_ip',
      'source_port',
      'dest_ip',
      'dest_port',
      'protocol_num',
      'is_blocked',
      'is_threat',
      'bytes_transferred',
      'hour_of_day',
    ],
    key_rename_map: {},
  },

  // 5. SOC Audit & Legal Non-Repudiation
  {
    id: 'soc_compliance_audit',
    name: 'SOC Compliance & Legal Non-Repudiation',
    description: 'Preserves 100% cryptographic lineage, normalized UTC timestamps, observer identity, and original SHA-256 seal for audit/court compliance.',
    is_preset: true,
    format: 'json',
    fields_to_include: [
      'event_id',
      'timestamp',
      'device.vendor',
      'device.product',
      'device.version',
      'device.hostname',
      'network.action',
      'source.ip',
      'destination.ip',
      'metadata.sha256_hash',
    ],
    key_rename_map: {
      'event_id': 'audit_record_uuid',
      'timestamp': 'certified_utc_timestamp',
      'device.vendor': 'sensor_vendor',
      'device.product': 'sensor_product',
      'device.version': 'sensor_firmware',
      'device.hostname': 'sensor_hostname',
      'network.action': 'sensor_decision',
      'metadata.sha256_hash': 'cryptographic_sha256_wire_seal',
    },
  },
];

/**
 * Output Profile Projector
 * Projects a CanonicalSemanticEvent into a target shape based on the selected OutputProfile.
 */
export function projectEvent(
  canonical: CanonicalSemanticEvent,
  profile: OutputProfile,
  extraContext?: { sha256_hash?: string }
): Record<string, unknown> {
  // If flat ML feature vector (SOC Anomaly / ML Analytics)
  if (profile.format === 'flat_json' || profile.id === 'soc_ml_analytics' || profile.id === 'analytics_ml_vector') {
    const protoMap: Record<string, number> = { TCP: 6, UDP: 17, ICMP: 1, GRE: 47, OTHER: 0 };
    const date = new Date(canonical.timestamp);
    const hour = Number.isNaN(date.getHours()) ? 12 : date.getHours();

    return {
      source_ip: canonical.source.ip || '0.0.0.0',
      source_port: canonical.source.port || 0,
      dest_ip: canonical.destination.ip || '0.0.0.0',
      dest_port: canonical.destination.port || 0,
      protocol_num: protoMap[canonical.network.protocol] || 0,
      is_blocked: canonical.network.action === 'BLOCKED' ? 1 : 0,
      is_threat: canonical.threat ? 1 : 0,
      bytes_transferred: (canonical.network.bytes_in || 0) + (canonical.network.bytes_out || 0),
      hour_of_day: hour,
    };
  }

  // Generic Projection based on fields_to_include & key_rename_map
  const projected: Record<string, unknown> = {};

  const getNestedVal = (obj: any, path: string): unknown => {
    if (path === 'metadata.sha256_hash' && extraContext?.sha256_hash) {
      return extraContext.sha256_hash;
    }
    const parts = path.split('.');
    let current = obj;
    for (const p of parts) {
      if (current === undefined || current === null) return undefined;
      current = current[p];
    }
    return current;
  };

  const setNestedVal = (target: any, path: string, val: unknown) => {
    const parts = path.split('.');
    let current = target;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part] || typeof current[part] !== 'object') {
        current[part] = {};
      }
      current = current[part];
    }
    current[parts[parts.length - 1]] = val;
  };

  for (const fieldPath of profile.fields_to_include) {
    const val = getNestedVal(canonical, fieldPath);
    if (val !== undefined && val !== null) {
      const targetKey = profile.key_rename_map?.[fieldPath] || fieldPath;
      if (targetKey.includes('.')) {
        setNestedVal(projected, targetKey, val);
      } else {
        projected[targetKey] = val;
      }
    }
  }

  return projected;
}
