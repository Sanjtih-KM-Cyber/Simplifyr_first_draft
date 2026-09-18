/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CanonicalSemanticEvent, OutputProfile } from '../types.ts';

export const PRESET_OUTPUT_PROFILES: OutputProfile[] = [
  // 1. SOC Incident Investigation
  {
    id: 'soc_investigation',
    name: 'SOC Incident Investigation',
    description: 'Prioritized for threat hunting: severity, action, source/dest IPs, alert signature, and tamper-proof hash.',
    is_preset: true,
    format: 'json',
    fields_to_include: [
      'event_id',
      'timestamp',
      'threat.severity',
      'threat.signature',
      'network.action',
      'network.protocol',
      'source.ip',
      'source.port',
      'destination.ip',
      'destination.port',
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

  // 2. Network Operations & Telemetry
  {
    id: 'netops_telemetry',
    name: 'Network Operations Telemetry',
    description: 'Bandwidth, session tracking, NAT translations, ports, and interface routing.',
    is_preset: true,
    format: 'json',
    fields_to_include: [
      'timestamp',
      'device.hostname',
      'source.ip',
      'source.port',
      'source.zone',
      'source.nat_ip',
      'source.nat_port',
      'destination.ip',
      'destination.port',
      'destination.zone',
      'network.protocol',
      'network.action',
      'network.session_id',
      'network.bytes_in',
      'network.bytes_out',
      'network.packets',
      'network.application',
    ],
    key_rename_map: {},
  },

  // 3. Enterprise SIEM Ingestion (ECS-aligned)
  {
    id: 'siem_ingest_ecs',
    name: 'Enterprise SIEM Ingest (ECS)',
    description: 'Conforms to Elastic Common Schema / Open Cybersecurity Schema Framework (OCSF) taxonomy.',
    is_preset: true,
    format: 'json',
    fields_to_include: [
      '@timestamp',
      'event.id',
      'event.action',
      'event.outcome',
      'source.ip',
      'source.port',
      'destination.ip',
      'destination.port',
      'network.transport',
      'network.application',
      'observer.vendor',
      'observer.product',
      'observer.version',
      'log.syslog.severity.name',
    ],
    key_rename_map: {},
  },

  // 4. Analytics & Machine Learning Feature Vector
  {
    id: 'analytics_ml_vector',
    name: 'ML Anomaly Feature Vector',
    description: 'Flat numerical and categorical feature vector suitable for isolation forests and anomaly detection.',
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
  // If flat ML feature vector
  if (profile.format === 'flat_json' || profile.id === 'analytics_ml_vector') {
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

  // If ECS SIEM format
  if (profile.id === 'siem_ingest_ecs') {
    return {
      '@timestamp': canonical.timestamp,
      event: {
        id: canonical.event_id,
        action: canonical.network.action.toLowerCase(),
        outcome: canonical.network.action === 'ALLOWED' ? 'success' : 'failure',
      },
      source: {
        ip: canonical.source.ip || null,
        port: canonical.source.port || null,
      },
      destination: {
        ip: canonical.destination.ip || null,
        port: canonical.destination.port || null,
      },
      network: {
        transport: canonical.network.protocol.toLowerCase(),
        application: canonical.network.application || null,
      },
      observer: {
        vendor: canonical.device.vendor,
        product: canonical.device.product,
        version: canonical.device.version,
      },
      threat: canonical.threat
        ? {
            severity: canonical.threat.severity,
            name: canonical.threat.signature || null,
          }
        : undefined,
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
