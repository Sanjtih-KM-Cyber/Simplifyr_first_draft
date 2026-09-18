/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FieldMappingRule, LogFormat, PerimeterVendor, VersionedMapping } from '../types.ts';

/**
 * Initial Knowledge Registry
 * Pre-seeded versioned vendor knowledge rules.
 * Document insight: "Vendor knowledge is data. Processing logic is software."
 */
export const INITIAL_KNOWLEDGE_BASE: VersionedMapping[] = [
  // 1. Cisco ASA / Firepower (PAN-OS / ASA Traffic)
  {
    mapping_id: 'cisco-asa-v9-traffic',
    vendor: 'cisco_asa',
    product: 'Cisco Adaptive Security Appliance (ASA)',
    software_version: 'v9.18',
    event_family: 'Firewall Traffic',
    format: 'syslog_rfc3164',
    status: 'active',
    created_at: '2026-09-01T00:00:00Z',
    approved_by: 'SecOps Team Lead',
    change_notes: 'Initial production baseline for ASA 5500-X connection teardowns and drops.',
    rules: [
      {
        input_field: 'src_ip',
        semantic_field: 'source.ip',
        transformation_type: 'identity',
        confidence: 0.99,
      },
      {
        input_field: 'src_port',
        semantic_field: 'source.port',
        transformation_type: 'cast',
        confidence: 0.99,
      },
      {
        input_field: 'src_zone',
        semantic_field: 'source.zone',
        transformation_type: 'identity',
        confidence: 0.95,
      },
      {
        input_field: 'dst_ip',
        semantic_field: 'destination.ip',
        transformation_type: 'identity',
        confidence: 0.99,
      },
      {
        input_field: 'dst_port',
        semantic_field: 'destination.port',
        transformation_type: 'cast',
        confidence: 0.99,
      },
      {
        input_field: 'dst_zone',
        semantic_field: 'destination.zone',
        transformation_type: 'identity',
        confidence: 0.95,
      },
      {
        input_field: 'proto',
        semantic_field: 'network.protocol',
        transformation_type: 'enum',
        enum_map: { tcp: 'TCP', udp: 'UDP', icmp: 'ICMP', ip: 'OTHER' },
        confidence: 0.98,
      },
      {
        input_field: 'action',
        semantic_field: 'network.action',
        transformation_type: 'enum',
        enum_map: {
          ALLOW: 'ALLOWED',
          DENY: 'BLOCKED',
          DROP: 'BLOCKED',
          TEARDOWN: 'ALLOWED',
          BUILT: 'ALLOWED',
        },
        confidence: 0.99,
      },
      {
        input_field: 'connection_id',
        semantic_field: 'network.session_id',
        transformation_type: 'identity',
        confidence: 0.95,
      },
      {
        input_field: 'syslog.severity',
        semantic_field: 'threat.severity',
        transformation_type: 'enum',
        enum_map: {
          '0': 'CRITICAL',
          '1': 'CRITICAL',
          '2': 'HIGH',
          '3': 'HIGH',
          '4': 'MEDIUM',
          '5': 'LOW',
          '6': 'INFORMATIONAL',
          '7': 'INFORMATIONAL',
        },
        confidence: 0.95,
      },
    ],
  },

  // 2. Palo Alto Networks PAN-OS
  {
    mapping_id: 'palo-alto-panos-10-traffic',
    vendor: 'palo_alto',
    product: 'PA-Series Next-Gen Firewall (PAN-OS)',
    software_version: 'v10.2',
    event_family: 'Firewall Traffic',
    format: 'syslog_rfc5424',
    status: 'active',
    created_at: '2026-09-02T00:00:00Z',
    approved_by: 'Network Security Architect',
    change_notes: 'PAN-OS 10.2 comma-delimited traffic and threat structure mapping.',
    rules: [
      {
        input_field: 'srcip',
        semantic_field: 'source.ip',
        transformation_type: 'identity',
        confidence: 0.99,
      },
      {
        input_field: 'sport',
        semantic_field: 'source.port',
        transformation_type: 'cast',
        confidence: 0.98,
      },
      {
        input_field: 'dstip',
        semantic_field: 'destination.ip',
        transformation_type: 'identity',
        confidence: 0.99,
      },
      {
        input_field: 'dport',
        semantic_field: 'destination.port',
        transformation_type: 'cast',
        confidence: 0.98,
      },
      {
        input_field: 'proto',
        semantic_field: 'network.protocol',
        transformation_type: 'enum',
        enum_map: { tcp: 'TCP', udp: 'UDP', icmp: 'ICMP', '6': 'TCP', '17': 'UDP' },
        confidence: 0.98,
      },
      {
        input_field: 'action',
        semantic_field: 'network.action',
        transformation_type: 'enum',
        enum_map: {
          allow: 'ALLOWED',
          deny: 'BLOCKED',
          drop: 'BLOCKED',
          'reset-client': 'BLOCKED',
          'reset-server': 'BLOCKED',
          'reset-both': 'BLOCKED',
        },
        confidence: 0.99,
      },
    ],
  },

  // 3. Fortinet FortiGate (CEF Format)
  {
    mapping_id: 'fortinet-fgt-v7-cef',
    vendor: 'fortinet_fortigate',
    product: 'FortiGate Enterprise Firewall (FortiOS)',
    software_version: 'v7.2.4',
    event_family: 'UTM & Firewall Traffic',
    format: 'cef',
    status: 'active',
    created_at: '2026-09-05T00:00:00Z',
    approved_by: 'Compliance & Audit Lead',
    change_notes: 'CEF ArcSight / FortiOS standardized mapping.',
    rules: [
      {
        input_field: 'src',
        semantic_field: 'source.ip',
        transformation_type: 'identity',
        confidence: 0.99,
      },
      {
        input_field: 'spt',
        semantic_field: 'source.port',
        transformation_type: 'cast',
        confidence: 0.99,
      },
      {
        input_field: 'dst',
        semantic_field: 'destination.ip',
        transformation_type: 'identity',
        confidence: 0.99,
      },
      {
        input_field: 'dpt',
        semantic_field: 'destination.port',
        transformation_type: 'cast',
        confidence: 0.99,
      },
      {
        input_field: 'proto',
        semantic_field: 'network.protocol',
        transformation_type: 'enum',
        enum_map: { '6': 'TCP', '17': 'UDP', '1': 'ICMP', tcp: 'TCP', udp: 'UDP' },
        confidence: 0.98,
      },
      {
        input_field: 'act',
        semantic_field: 'network.action',
        transformation_type: 'enum',
        enum_map: {
          deny: 'BLOCKED',
          drop: 'BLOCKED',
          block: 'BLOCKED',
          allow: 'ALLOWED',
          permit: 'ALLOWED',
          accept: 'ALLOWED',
        },
        confidence: 0.99,
      },
      {
        input_field: 'app',
        semantic_field: 'network.application',
        transformation_type: 'identity',
        confidence: 0.92,
      },
      {
        input_field: 'cef.severity',
        semantic_field: 'threat.severity',
        transformation_type: 'enum',
        enum_map: {
          '0': 'INFORMATIONAL',
          '1': 'LOW',
          '2': 'LOW',
          '3': 'MEDIUM',
          '4': 'MEDIUM',
          '5': 'HIGH',
          '6': 'HIGH',
          '7': 'CRITICAL',
          '8': 'CRITICAL',
          '9': 'CRITICAL',
          '10': 'CRITICAL',
        },
        confidence: 0.94,
      },
    ],
  },

  // 4. Check Point Quantum (LEEF Format)
  {
    mapping_id: 'checkpoint-quantum-r81-leef',
    vendor: 'checkpoint_quantum',
    product: 'Check Point Quantum Security Gateway',
    software_version: 'R81.20',
    event_family: 'Firewall Connection',
    format: 'leef',
    status: 'active',
    created_at: '2026-09-08T00:00:00Z',
    approved_by: 'SOC Incident Lead',
    change_notes: 'QRadar LEEF formatted firewall drops and rule triggers.',
    rules: [
      {
        input_field: 'src',
        semantic_field: 'source.ip',
        transformation_type: 'identity',
        confidence: 0.99,
      },
      {
        input_field: 'spt',
        semantic_field: 'source.port',
        transformation_type: 'cast',
        confidence: 0.99,
      },
      {
        input_field: 'dst',
        semantic_field: 'destination.ip',
        transformation_type: 'identity',
        confidence: 0.99,
      },
      {
        input_field: 'dpt',
        semantic_field: 'destination.port',
        transformation_type: 'cast',
        confidence: 0.99,
      },
      {
        input_field: 'proto',
        semantic_field: 'network.protocol',
        transformation_type: 'enum',
        enum_map: { '6': 'TCP', '17': 'UDP', '1': 'ICMP', tcp: 'TCP', udp: 'UDP' },
        confidence: 0.98,
      },
      {
        input_field: 'action',
        semantic_field: 'network.action',
        transformation_type: 'enum',
        enum_map: {
          drop: 'BLOCKED',
          reject: 'BLOCKED',
          block: 'BLOCKED',
          accept: 'ALLOWED',
        },
        confidence: 0.99,
      },
      {
        input_field: 'rule',
        semantic_field: 'threat.signature',
        transformation_type: 'identity',
        confidence: 0.9,
      },
    ],
  },

  // 5. Snort / Suricata IDS
  {
    mapping_id: 'snort-ids-v3-alert',
    vendor: 'snort_ids',
    product: 'Snort Network Intrusion Detection System',
    software_version: 'v3.1',
    event_family: 'Intrusion Detection Alert',
    format: 'syslog_rfc3164',
    status: 'active',
    created_at: '2026-09-10T00:00:00Z',
    approved_by: 'Lead Threat Hunter',
    change_notes: 'Snort FastAlert pattern mapping for exploit detection.',
    rules: [
      {
        input_field: 'srcip',
        semantic_field: 'source.ip',
        transformation_type: 'identity',
        confidence: 0.98,
      },
      {
        input_field: 'sport',
        semantic_field: 'source.port',
        transformation_type: 'cast',
        confidence: 0.98,
      },
      {
        input_field: 'dstip',
        semantic_field: 'destination.ip',
        transformation_type: 'identity',
        confidence: 0.98,
      },
      {
        input_field: 'dport',
        semantic_field: 'destination.port',
        transformation_type: 'cast',
        confidence: 0.98,
      },
      {
        input_field: 'proto',
        semantic_field: 'network.protocol',
        transformation_type: 'enum',
        enum_map: { '{TCP}': 'TCP', '{UDP}': 'UDP', '{ICMP}': 'ICMP', TCP: 'TCP', UDP: 'UDP' },
        confidence: 0.98,
      },
      {
        input_field: 'action',
        semantic_field: 'network.action',
        transformation_type: 'enum',
        enum_map: { alert: 'ALERT', drop: 'BLOCKED' },
        confidence: 0.99,
      },
      {
        input_field: 'signature',
        semantic_field: 'threat.signature',
        transformation_type: 'identity',
        confidence: 0.99,
      },
      {
        input_field: 'priority',
        semantic_field: 'threat.severity',
        transformation_type: 'enum',
        enum_map: {
          '1': 'CRITICAL',
          '2': 'HIGH',
          '3': 'MEDIUM',
          '4': 'LOW',
        },
        confidence: 0.95,
      },
    ],
  },

  // 6. Generic Cloud Perimeter Gateway (JSON)
  {
    mapping_id: 'generic-cloud-gw-json',
    vendor: 'generic_firewall',
    product: 'Cloud Perimeter Gateway',
    software_version: 'v1.0',
    event_family: 'Firewall Traffic',
    format: 'json',
    status: 'active',
    created_at: '2026-09-12T00:00:00Z',
    approved_by: 'Cloud Ops Team',
    change_notes: 'Nested JSON dot-notation mapping.',
    rules: [
      {
        input_field: 'connection.src_ip',
        semantic_field: 'source.ip',
        transformation_type: 'identity',
        confidence: 0.99,
      },
      {
        input_field: 'connection.src_port',
        semantic_field: 'source.port',
        transformation_type: 'cast',
        confidence: 0.99,
      },
      {
        input_field: 'connection.dst_ip',
        semantic_field: 'destination.ip',
        transformation_type: 'identity',
        confidence: 0.99,
      },
      {
        input_field: 'connection.dst_port',
        semantic_field: 'destination.port',
        transformation_type: 'cast',
        confidence: 0.99,
      },
      {
        input_field: 'connection.protocol',
        semantic_field: 'network.protocol',
        transformation_type: 'enum',
        enum_map: { TCP: 'TCP', UDP: 'UDP', ICMP: 'ICMP' },
        confidence: 0.99,
      },
      {
        input_field: 'policy.action',
        semantic_field: 'network.action',
        transformation_type: 'enum',
        enum_map: { ALLOW: 'ALLOWED', DENY: 'BLOCKED', DROP: 'BLOCKED' },
        confidence: 0.99,
      },
      {
        input_field: 'policy.bytes',
        semantic_field: 'network.bytes_in',
        transformation_type: 'cast',
        confidence: 0.95,
      },
    ],
  },
];

/**
 * Knowledge Registry Service
 * Manages versioned knowledge as data, preventing code changes when schemas drift.
 */
class KnowledgeRegistryService {
  private mappings: VersionedMapping[] = [...INITIAL_KNOWLEDGE_BASE];

  public getAllMappings(): VersionedMapping[] {
    return [...this.mappings];
  }

  public getMappingById(mappingId: string): VersionedMapping | undefined {
    return this.mappings.find((m) => m.mapping_id === mappingId);
  }

  public findBestMapping(
    vendor: PerimeterVendor,
    format: LogFormat,
    productHint?: string
  ): VersionedMapping | undefined {
    // 1. Try exact vendor match with active status
    const byVendor = this.mappings.filter(
      (m) => m.vendor === vendor && m.status === 'active'
    );
    if (byVendor.length === 1) return byVendor[0];
    if (byVendor.length > 1) {
      // Prioritize format match
      const byFormat = byVendor.find((m) => m.format === format);
      if (byFormat) return byFormat;
      return byVendor[0];
    }

    // 2. Fallback to format match
    const byFormat = this.mappings.find(
      (m) => m.format === format && m.status === 'active'
    );
    if (byFormat) return byFormat;

    // 3. Fallback to generic
    return this.mappings.find((m) => m.vendor === 'generic_firewall');
  }

  public registerNewVersion(
    baseMappingId: string,
    newVersion: string,
    newRules: FieldMappingRule[],
    approvedBy: string,
    notes?: string
  ): VersionedMapping {
    const base = this.getMappingById(baseMappingId);
    if (!base) {
      throw new Error(`Base mapping ${baseMappingId} not found`);
    }

    const newMapping: VersionedMapping = {
      ...base,
      mapping_id: `${base.vendor}-${newVersion.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      software_version: newVersion,
      rules: newRules,
      status: 'active',
      created_at: new Date().toISOString(),
      approved_by: approvedBy,
      change_notes: notes || `Auto-versioned from ${base.software_version}`,
    };

    this.mappings.unshift(newMapping);
    return newMapping;
  }

  public addMapping(mapping: VersionedMapping): void {
    this.mappings.unshift(mapping);
  }

  public registerMapping(mapping: VersionedMapping): void {
    this.mappings.unshift(mapping);
  }
}

export const knowledgeRegistry = new KnowledgeRegistryService();
