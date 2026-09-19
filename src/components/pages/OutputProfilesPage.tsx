/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card.tsx';
import { Button } from '../ui/button.tsx';
import { Badge } from '../ui/badge.tsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table.tsx';
import {
  Sliders,
  Check,
  Copy,
  Sparkles,
  Shield,
  Database,
  Layers,
  Search,
  CheckCircle2,
  RotateCcw,
  ArrowRight,
  Filter,
  Plus,
  Trash2,
  Users,
  Target,
  Cpu,
  FileCheck,
  Lock,
  Activity,
  Terminal,
  Server,
  Zap,
} from 'lucide-react';
import { VersionedMapping } from '../../types.ts';
import { knowledgeRegistry } from '../../services/knowledgeRegistry.ts';
import { GOLDEN_CORPUS } from '../../data/goldenCorpus.ts';
import { processRawEventThroughPipeline } from '../../services/streamSimulator.ts';

interface SchemaFieldDefinition {
  id: string;
  label: string;
  canonicalPath: string;
  defaultKey: string;
  exampleValue: string | number;
  description: string;
  isCustom?: boolean;
}

const AVAILABLE_SCHEMA_FIELDS: SchemaFieldDefinition[] = [
  {
    id: 'timestamp',
    label: 'Timestamp',
    canonicalPath: 'timestamp',
    defaultKey: 'timestamp',
    exampleValue: new Date().toISOString(),
    description: 'Normalized ISO-8601 UTC timestamp',
  },
  {
    id: 'source_ip',
    label: 'Source IP',
    canonicalPath: 'source.ip',
    defaultKey: 'source_ip',
    exampleValue: '198.51.100.24',
    description: 'Ingress client or threat source IP',
  },
  {
    id: 'source_port',
    label: 'Source Port',
    canonicalPath: 'source.port',
    defaultKey: 'source_port',
    exampleValue: 54210,
    description: 'Originating TCP/UDP port number',
  },
  {
    id: 'source_nat_ip',
    label: 'Source NAT IP',
    canonicalPath: 'source.nat_ip',
    defaultKey: 'source_nat_ip',
    exampleValue: '198.51.100.99',
    description: 'Translated post-NAT ingress IP address',
  },
  {
    id: 'destination_ip',
    label: 'Destination IP',
    canonicalPath: 'destination.ip',
    defaultKey: 'destination_ip',
    exampleValue: '10.10.4.12',
    description: 'Internal target server or VIP address',
  },
  {
    id: 'destination_port',
    label: 'Destination Port',
    canonicalPath: 'destination.port',
    defaultKey: 'destination_port',
    exampleValue: 443,
    description: 'Target service port number',
  },
  {
    id: 'protocol',
    label: 'Protocol',
    canonicalPath: 'network.protocol',
    defaultKey: 'protocol',
    exampleValue: 'TCP',
    description: 'L4 network protocol (TCP, UDP, ICMP)',
  },
  {
    id: 'action',
    label: 'Action Verdict',
    canonicalPath: 'network.action',
    defaultKey: 'action',
    exampleValue: 'BLOCKED',
    description: 'Enforcement decision: ALLOWED, BLOCKED, or ALERT',
  },
  {
    id: 'severity',
    label: 'Threat Severity',
    canonicalPath: 'threat.severity',
    defaultKey: 'severity',
    exampleValue: 'HIGH',
    description: 'Normalized rating (LOW, MEDIUM, HIGH, CRITICAL)',
  },
  {
    id: 'threat_signature',
    label: 'Threat Signature',
    canonicalPath: 'threat.signature',
    defaultKey: 'threat_signature',
    exampleValue: 'CVE-2024-3400 GlobalProtect Command Injection',
    description: 'Matched IDS/IPS threat signature, CVE, or rule name',
  },
  {
    id: 'device_product',
    label: 'Firewall Device',
    canonicalPath: 'device.product',
    defaultKey: 'device',
    exampleValue: 'Cisco ASA 5500-X / Secure Firewall',
    description: 'Hardware or virtual firewall appliance product',
  },
  {
    id: 'device_hostname',
    label: 'Device Hostname',
    canonicalPath: 'device.hostname',
    defaultKey: 'host_name',
    exampleValue: 'asa-perimeter-01',
    description: 'Perimeter gateway hostname',
  },
  {
    id: 'session_id',
    label: 'Session ID',
    canonicalPath: 'network.session_id',
    defaultKey: 'session_id',
    exampleValue: '9841221',
    description: 'Connection or flow tracking ID',
  },
  {
    id: 'bytes_transferred',
    label: 'Bytes Transferred',
    canonicalPath: 'network.bytes',
    defaultKey: 'bytes_transferred',
    exampleValue: 14820,
    description: 'Total combined session traffic (bytes_in + bytes_out)',
  },
  {
    id: 'raw_sha256',
    label: 'SHA-256 Seal',
    canonicalPath: 'envelope.sha256_hash',
    defaultKey: 'raw_sha256',
    exampleValue: '9f83...a12c',
    description: 'Cryptographic hash proof of original raw bytes',
  },
];

export interface OutputTemplate {
  id: string;
  name: string;
  badge: string;
  desc: string;
  activeIds: string[];
  customKeys: Record<string, string>;
}

const TEMPLATES: OutputTemplate[] = [
  {
    id: 'soc_triage',
    name: 'SOC Alert Triage (Tier 1)',
    badge: 'Tier 1 Triage',
    desc: 'High-signal analyst disposition: action verdict, threat severity, alert signature, and 5-tuple.',
    activeIds: ['timestamp', 'action', 'severity', 'threat_signature', 'source_ip', 'destination_ip', 'destination_port', 'protocol', 'device_product'],
    customKeys: {
      timestamp: 'timestamp',
      action: 'verdict',
      severity: 'severity',
      threat_signature: 'alert_signature',
      source_ip: 'src_ip',
      destination_ip: 'dst_ip',
      destination_port: 'dst_port',
      protocol: 'protocol',
      device_product: 'device_product',
    },
  },
  {
    id: 'soc_investigation',
    name: 'SOC Incident Response & Deep Hunt',
    badge: 'Tier 2/3 Response',
    desc: 'Forensic incident investigation: session IDs, NAT translations, protocol telemetry, and SHA-256 seal.',
    activeIds: ['timestamp', 'action', 'severity', 'threat_signature', 'source_ip', 'source_port', 'source_nat_ip', 'destination_ip', 'destination_port', 'protocol', 'session_id', 'device_hostname', 'raw_sha256'],
    customKeys: {
      timestamp: 'timestamp',
      action: 'firewall_action',
      severity: 'severity',
      threat_signature: 'alert_name',
      source_ip: 'src_ip',
      source_port: 'src_port',
      source_nat_ip: 'src_nat_ip',
      destination_ip: 'dest_ip',
      destination_port: 'dest_port',
      protocol: 'protocol',
      session_id: 'session_id',
      device_hostname: 'gateway_host',
      raw_sha256: 'sha256_hash',
    },
  },
  {
    id: 'soc_threat_intel',
    name: 'SOC Threat Intel & IOC Matching',
    badge: 'Threat Intel',
    desc: 'Extracted network observables, matched signatures, and indicators for TIP/MISP correlation.',
    activeIds: ['timestamp', 'source_ip', 'destination_ip', 'destination_port', 'protocol', 'threat_signature', 'severity', 'action', 'device_hostname', 'raw_sha256'],
    customKeys: {
      timestamp: 'observed_at',
      source_ip: 'observable_src_ip',
      destination_ip: 'observable_dst_ip',
      destination_port: 'observable_port',
      protocol: 'protocol',
      threat_signature: 'matched_ioc',
      severity: 'ioc_confidence',
      action: 'policy_verdict',
      device_hostname: 'reporting_sensor',
      raw_sha256: 'evidence_sha256',
    },
  },
  {
    id: 'soc_ml_anomaly',
    name: 'SOC AI/ML Behavioral Anomaly Vector',
    badge: 'AI / Data Science',
    desc: 'Feature vector representation for isolation forests, clustering, and unsupervised anomaly models.',
    activeIds: ['source_ip', 'source_port', 'destination_ip', 'destination_port', 'protocol', 'action', 'severity', 'bytes_transferred'],
    customKeys: {
      source_ip: 'source_ip',
      source_port: 'source_port',
      destination_ip: 'dest_ip',
      destination_port: 'dest_port',
      protocol: 'protocol_num',
      action: 'is_blocked',
      severity: 'threat_weight',
      bytes_transferred: 'bytes_transferred',
    },
  },
  {
    id: 'soc_compliance_audit',
    name: 'SOC Compliance & Legal Non-Repudiation',
    badge: 'Audit & GRC',
    desc: 'Cryptographic chain of custody: certified UTC timestamp, sensor identity, and immutable SHA-256 seal.',
    activeIds: ['timestamp', 'device_product', 'device_hostname', 'action', 'source_ip', 'destination_ip', 'raw_sha256'],
    customKeys: {
      timestamp: 'certified_utc_timestamp',
      device_product: 'sensor_product',
      device_hostname: 'sensor_hostname',
      action: 'sensor_decision',
      source_ip: 'origin_client_ip',
      destination_ip: 'target_endpoint_ip',
      raw_sha256: 'cryptographic_sha256_wire_seal',
    },
  },
  {
    id: 'custom_scratch',
    name: 'Custom Output Schema (Interactive Builder)',
    badge: 'Custom Schema',
    desc: 'Build your own schema from scratch: pick any fields, define custom keys, and add custom attributes.',
    activeIds: ['timestamp', 'source_ip', 'destination_ip', 'action', 'device_product'],
    customKeys: {
      timestamp: 'event_time',
      source_ip: 'src_ip',
      destination_ip: 'dst_ip',
      action: 'status',
      device_product: 'device_type',
    },
  },
];

export interface EnterprisePersona {
  id: string;
  role: string;
  department: string;
  badgeColor: string;
  mission: string;
  painPoints: string[];
  ulpfSolution: string;
  expectedOutcomes: string[];
  recommendedProfileId: string;
  recommendedProfileName: string;
}

const ENTERPRISE_PERSONAS: EnterprisePersona[] = [
  {
    id: 'soc_t1',
    role: 'Tier 1 SOC Analyst',
    department: 'Security Operations Center (SOC)',
    badgeColor: 'border-blue-500/40 text-blue-400 bg-blue-500/10',
    mission: 'Perform rapid initial alert triage, validate true vs. false positives, and escalate high-severity incidents within strict MTTR SLAs.',
    painPoints: [
      'Inundated with disparate log formats (Syslog, JSON, CEF, proprietary text) across firewalls, proxies, and endpoint agents.',
      'Wasting time manually reading and decoding vendor-specific action codes and severity representations.',
      'Context switching between multiple vendor consoles to determine source and destination endpoints.',
    ],
    ulpfSolution: 'Normalizes disparate perimeter logs into a common event taxonomy with standardized action verdicts (ALLOWED / BLOCKED), unified threat severity ratings, and 5-tuple context.',
    expectedOutcomes: [
      'Sub-second triage latency without manual regex parsing',
      'Consistent verdict and threat level regardless of firewall make',
      'Direct integration with Tier 1 SOAR playbooks',
    ],
    recommendedProfileId: 'soc_triage',
    recommendedProfileName: 'SOC Alert Triage (Tier 1)',
  },
  {
    id: 'soc_t2_t3',
    role: 'Tier 2/3 Incident Responder & Threat Hunter',
    department: 'Incident Response & Advanced Cyber Defense',
    badgeColor: 'border-purple-500/40 text-purple-400 bg-purple-500/10',
    mission: 'Conduct deep-dive forensic investigations of multi-stage cyber attacks, uncover lateral movement, and hunt for stealthy adversaries.',
    painPoints: [
      'Correlating perimeter hops across multiple firewall vendors where NAT, session IDs, and zone tags are named completely differently.',
      'Partial or lossy normalization by traditional log forwarders that strip diagnostic session IDs or packet counters.',
      'Difficulty reconstructing the full lifecycle of an attack due to missing telemetry fields.',
    ],
    ulpfSolution: 'Preserves complete event context without information loss (Expected Solution a, b), normalizing NAT translations, flow tracking IDs, and threat signatures into unified schema.',
    expectedOutcomes: [
      'Seamless multi-vendor attack chain reconstruction',
      'Pre- and post-NAT IP correlation across firewall perimeters',
      'Rapid pivoting from raw payload to forensic taxonomy',
    ],
    recommendedProfileId: 'soc_investigation',
    recommendedProfileName: 'SOC Incident Response & Deep Hunt',
  },
  {
    id: 'siem_data_eng',
    role: 'SIEM / Data Lake / Big Data Engineer',
    department: 'Security Platform Engineering & Data Infrastructure',
    badgeColor: 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10',
    mission: 'Ingest, index, and manage petabytes of security telemetry into SIEMs (Splunk, Elastic, Sentinel) and Data Lakes (Snowflake, BigQuery, ClickHouse) at scale.',
    painPoints: [
      'Substantial engineering effort spent developing and maintaining source-specific parsers for each vendor.',
      'Vendor firmware updates frequently break existing regex parsers, leading to schema drift and silent ingestion failures.',
      'Rigid SIEM forwarders force unneeded heavy schemas that inflate indexing licensing costs.',
    ],
    ulpfSolution: 'Plug-and-play onboarding (Expected Solution e) with automated schema drift detection (Expected Solution g) and custom output schema projection matching exact downstream database tables.',
    expectedOutcomes: [
      'Dramatic reduction in parser development and maintenance overhead (Expected Solution i)',
      'Custom JSON key renaming without pipeline code changes',
      'Zero-loss high-throughput normalization for data lakes',
    ],
    recommendedProfileId: 'custom_scratch',
    recommendedProfileName: 'Custom Output Schema (Interactive Builder)',
  },
  {
    id: 'ai_data_scientist',
    role: 'Cybersecurity AI/ML Data Scientist',
    department: 'AI Security Analytics & Machine Learning',
    badgeColor: 'border-amber-500/40 text-amber-400 bg-amber-500/10',
    mission: 'Train and deploy unsupervised anomaly detection, isolation forests, clustering models, and sequence models for user and network behavioral analytics (UEBA).',
    painPoints: [
      'Raw security logs are non-standardized strings requiring weeks of bespoke data engineering before feature extraction is possible.',
      'Vendor text noise, timestamp drift, and inconsistent categorical codes disrupt machine learning inference pipelines.',
      'Feature engineering pipelines frequently break when a new network device model is introduced.',
    ],
    ulpfSolution: 'AI/ML-ready security and operational analytics (Expected Solution h) projecting canonical logs into numerical and categorical feature vectors in real time.',
    expectedOutcomes: [
      'Clean numerical feature vectors (IP integers, protocol numbers, byte counters) ready for scikit-learn / PyTorch',
      'Normalized categorical flags (is_blocked, is_threat, hour_of_day)',
      'Continuous feature stream with zero preprocessing bottleneck',
    ],
    recommendedProfileId: 'soc_ml_anomaly',
    recommendedProfileName: 'SOC AI/ML Behavioral Anomaly Vector',
  },
  {
    id: 'dfir_compliance',
    role: 'Forensic Investigator & GRC Compliance Auditor',
    department: 'Digital Forensics & Regulatory Compliance (GRC)',
    badgeColor: 'border-rose-500/40 text-rose-400 bg-rose-500/10',
    mission: 'Ensure compliance with strict security frameworks (PCI-DSS 10.x, HIPAA, NIST SP 800-92, ISO 27001) and maintain legally defensible chains of custody for court evidence.',
    painPoints: [
      'Aggressive normalizers discard raw logs or alter field contents, rendering records inadmissible as legal forensic evidence.',
      'Inability to prove that normalized records have not been tampered with or modified post-ingest.',
      'Auditors reject non-repudiation assertions due to lack of cryptographic provenance.',
    ],
    ulpfSolution: '100% preservation of complete raw event data without information loss (Expected Solution a), immutable SHA-256 cryptographic wire seals (Expected Solution d), and bidirectional raw-to-canonical provenance.',
    expectedOutcomes: [
      'Court-admissible tamper-evident cryptographic seals',
      'Complete raw byte preservation satisfying PCI-DSS & NIST SP 800-92',
      'Bidirectional lineage between normalized schema and raw byte packets',
    ],
    recommendedProfileId: 'soc_compliance_audit',
    recommendedProfileName: 'SOC Compliance & Legal Non-Repudiation',
  },
  {
    id: 'netsec_admin',
    role: 'Network Security & Perimeter Infrastructure Engineer',
    department: 'Network Operations (NetOps) & Infrastructure',
    badgeColor: 'border-cyan-500/40 text-cyan-400 bg-cyan-500/10',
    mission: 'Provision, monitor, and safeguard enterprise network devices across firewalls, edge routers, VPN gateways, WAFs, and intrusion prevention systems.',
    painPoints: [
      'Heterogeneous perimeter fleet with devices from Cisco, Palo Alto Networks, Fortinet, Check Point, and Snort logging in different formats.',
      'Adding or migrating to a new firewall hardware vendor requires months of coordination with security analytics teams.',
      'Lack of centralized operational visibility across mixed multi-vendor perimeters.',
    ],
    ulpfSolution: 'Vendor-agnostic architecture suitable for multi-vendor enterprise fleets, enabling plug-and-play addition of new perimeter log sources regardless of underlying format or hardware.',
    expectedOutcomes: [
      'Multi-vendor perimeter fleet normalization under one unified engine',
      'Zero vendor lock-in for enterprise network hardware migrations',
      'Instant verification that new network appliances are properly parsed',
    ],
    recommendedProfileId: 'soc_investigation',
    recommendedProfileName: 'SOC Incident Response & Deep Hunt',
  },
  {
    id: 'airgap_defense_op',
    role: 'Air-Gapped & Sovereign Enterprise Operator',
    department: 'Critical National Infrastructure & Sovereign Defense',
    badgeColor: 'border-yellow-500/40 text-yellow-400 bg-yellow-500/10',
    mission: 'Operate security monitoring in disconnected air-gapped networks, classified enclaves, SCADA/ICS facilities, and sovereign defense infrastructure.',
    painPoints: [
      'Modern cloud-reliant SIEM agents and parsers require external internet connections, failing air-gap compliance mandates.',
      'Heavy monolithic architectures cannot be easily packaged or deployed inside isolated container runtimes.',
      'Risk of sensitive defense network telemetry leaking to public SaaS vendors.',
    ],
    ulpfSolution: 'Air-gapped deployment capability (Expected Solution j) packaged in a standalone container (Expected Solution k) with deterministic on-prem regex and local AI logic requiring zero external egress.',
    expectedOutcomes: [
      '100% offline, self-contained operation inside air-gapped facilities',
      'Zero external telemetry egress or cloud dependencies',
      'Containerized platform-independent deployment on Linux/Docker/K8s',
    ],
    recommendedProfileId: 'soc_compliance_audit',
    recommendedProfileName: 'SOC Compliance & Legal Non-Repudiation',
  },
];

export const OutputProfilesPage: React.FC = () => {
  const [viewTab, setViewTab] = useState<'builder' | 'personas' | 'knowledge'>('builder');
  const [schemaFields, setSchemaFields] = useState<SchemaFieldDefinition[]>(AVAILABLE_SCHEMA_FIELDS);
  const [activeFieldIds, setActiveFieldIds] = useState<Set<string>>(
    new Set(TEMPLATES[0].activeIds)
  );
  const [fieldKeyNames, setFieldKeyNames] = useState<Record<string, string>>({
    ...TEMPLATES[0].customKeys,
  });
  const [activeTemplate, setActiveTemplate] = useState<string>('soc_triage');
  const [copied, setCopied] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // New Custom Field dialog / form inputs
  const [isAddingField, setIsAddingField] = useState(false);
  const [newFieldKey, setNewFieldKey] = useState('');
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldSample, setNewFieldSample] = useState('');

  // Knowledge Registry search & filter
  const [mappings] = useState<VersionedMapping[]>(knowledgeRegistry.getAllMappings());
  const [search, setSearch] = useState('');
  const [vendorFilter, setVendorFilter] = useState('all');

  // Sample event for realistic live payload preview
  const sampleEvent = useMemo(() => {
    try {
      const raw = GOLDEN_CORPUS[0]?.raw || '';
      return processRawEventThroughPipeline(raw);
    } catch {
      return null;
    }
  }, []);

  const handleApplyTemplate = (tpl: typeof TEMPLATES[0]) => {
    setActiveTemplate(tpl.id);
    setActiveFieldIds(new Set(tpl.activeIds));
    setFieldKeyNames((prev) => ({
      ...prev,
      ...tpl.customKeys,
    }));
  };

  const handleLoadPersonaProfile = (profileId: string) => {
    const tpl = TEMPLATES.find((t) => t.id === profileId) || TEMPLATES[0];
    handleApplyTemplate(tpl);
    setViewTab('builder');
  };

  const handleStartBlankCustom = () => {
    setActiveTemplate('custom_scratch');
    setActiveFieldIds(new Set(['timestamp', 'source_ip', 'destination_ip', 'action']));
    setFieldKeyNames({
      timestamp: 'event_time',
      source_ip: 'src_ip',
      destination_ip: 'dst_ip',
      action: 'action',
    });
  };

  const handleToggleField = (fieldId: string) => {
    setActiveTemplate(''); // Custom mode
    setActiveFieldIds((prev) => {
      const next = new Set(prev);
      if (next.has(fieldId)) {
        next.delete(fieldId);
      } else {
        next.add(fieldId);
      }
      return next;
    });
  };

  const handleKeyRename = (fieldId: string, newKeyName: string) => {
    setActiveTemplate(''); // Custom mode
    setFieldKeyNames((prev) => ({
      ...prev,
      [fieldId]: newKeyName,
    }));
  };

  const handleAddCustomField = () => {
    if (!newFieldKey.trim()) return;
    const cleanKey = newFieldKey.trim().replace(/[^a-zA-Z0-9_.]/g, '_').toLowerCase();
    const id = `custom_${cleanKey}_${Date.now()}`;
    const customDef: SchemaFieldDefinition = {
      id,
      label: newFieldLabel.trim() || cleanKey,
      canonicalPath: `custom.${cleanKey}`,
      defaultKey: cleanKey,
      exampleValue: newFieldSample.trim() || 'user_custom_data',
      description: 'User-defined custom enrichment / telemetry field',
      isCustom: true,
    };

    setSchemaFields((prev) => [...prev, customDef]);
    setActiveFieldIds((prev) => new Set([...prev, id]));
    setFieldKeyNames((prev) => ({ ...prev, [id]: cleanKey }));
    setNewFieldKey('');
    setNewFieldLabel('');
    setNewFieldSample('');
    setIsAddingField(false);
    setActiveTemplate('');
  };

  const handleRemoveCustomField = (fieldId: string) => {
    setSchemaFields((prev) => prev.filter((f) => f.id !== fieldId));
    setActiveFieldIds((prev) => {
      const next = new Set(prev);
      next.delete(fieldId);
      return next;
    });
  };

  // Generate live payload based on selected fields and custom key names
  const livePayload = useMemo(() => {
    const payload: Record<string, unknown> = {};
    const norm = sampleEvent?.canonical;

    schemaFields.forEach((field) => {
      if (!activeFieldIds.has(field.id)) return;

      const outputKey = fieldKeyNames[field.id] || field.defaultKey;

      if (!norm) {
        payload[outputKey] = field.exampleValue;
        return;
      }

      switch (field.id) {
        case 'timestamp':
          payload[outputKey] = norm.timestamp || field.exampleValue;
          break;
        case 'source_ip':
          payload[outputKey] = norm.source?.ip || field.exampleValue;
          break;
        case 'source_port':
          payload[outputKey] = norm.source?.port || field.exampleValue;
          break;
        case 'source_nat_ip':
          payload[outputKey] = norm.source?.nat_ip || field.exampleValue;
          break;
        case 'destination_ip':
          payload[outputKey] = norm.destination?.ip || field.exampleValue;
          break;
        case 'destination_port':
          payload[outputKey] = norm.destination?.port || field.exampleValue;
          break;
        case 'protocol':
          payload[outputKey] = norm.network?.protocol || field.exampleValue;
          break;
        case 'action':
          payload[outputKey] = norm.network?.action || field.exampleValue;
          break;
        case 'severity':
          payload[outputKey] = norm.threat?.severity || field.exampleValue;
          break;
        case 'threat_signature':
          payload[outputKey] = norm.threat?.signature || field.exampleValue;
          break;
        case 'device_product':
          payload[outputKey] = norm.device?.product || field.exampleValue;
          break;
        case 'device_hostname':
          payload[outputKey] = norm.device?.hostname || field.exampleValue;
          break;
        case 'session_id':
          payload[outputKey] = norm.network?.session_id || field.exampleValue;
          break;
        case 'bytes_transferred':
          payload[outputKey] = ((norm.network?.bytes_in || 0) + (norm.network?.bytes_out || 0)) || field.exampleValue;
          break;
        case 'raw_sha256':
          payload[outputKey] = sampleEvent?.envelope?.sha256_hash?.slice(0, 16) || field.exampleValue;
          break;
        default:
          payload[outputKey] = field.exampleValue;
      }
    });

    return payload;
  }, [schemaFields, activeFieldIds, fieldKeyNames, sampleEvent]);

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(livePayload, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveProfile = () => {
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  // Filtered Knowledge Registry mappings
  const filteredMappings = mappings.filter((m) => {
    const matchesVendor = vendorFilter === 'all' || m.vendor === vendorFilter;
    const matchesSearch =
      m.product.toLowerCase().includes(search.toLowerCase()) ||
      m.vendor.toLowerCase().includes(search.toLowerCase()) ||
      m.software_version.toLowerCase().includes(search.toLowerCase());
    return matchesVendor && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Top Header & Intro */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
            <Sliders className="h-5 w-5 text-emerald-400" />
            Custom Output Schema Builder
          </h1>
          <p className="text-xs text-zinc-400 mt-1 max-w-3xl">
            Simplifyr never forces a rigid schema on your team. Build custom schemas, customize fields, and rename target JSON keys to match whatever your SIEM, Data Lake, or SOAR expects.
          </p>
        </div>

        {/* View Switcher */}
        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-zinc-900 border border-zinc-800 self-start sm:self-auto">
          <button
            onClick={() => setViewTab('builder')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              viewTab === 'builder'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sliders className="h-3.5 w-3.5" />
            Schema Builder
          </button>
          <button
            onClick={() => setViewTab('personas')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              viewTab === 'personas'
                ? 'bg-purple-500/10 text-purple-300 border border-purple-500/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            Enterprise Personas & ULPF
          </button>
          <button
            onClick={() => setViewTab('knowledge')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              viewTab === 'knowledge'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Database className="h-3.5 w-3.5" />
            Vendor Mappings ({mappings.length})
          </button>
        </div>
      </div>

      {viewTab === 'builder' ? (
        <div className="space-y-6">
          {/* Custom Output Schema Builder Guidance Callout */}
          <div className="p-3.5 rounded-lg border border-emerald-500/30 bg-emerald-950/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-md bg-emerald-500/10 border border-emerald-500/30 shrink-0 mt-0.5">
                <Sparkles className="h-4 w-4 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-xs font-semibold text-emerald-300 flex items-center gap-2">
                  Interactive Custom Output Schema Builder
                  <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 text-[10px]">
                    Active Workspace
                  </Badge>
                </h2>
                <p className="text-[11px] text-zinc-300 mt-0.5 max-w-2xl leading-relaxed">
                  Tailor output schemas for your exact downstream destination. Pick any SOC template below, toggle fields in the table, rename target JSON keys inline, or add custom enrichment attributes.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleStartBlankCustom}
                className="h-7 text-xs border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 cursor-pointer"
              >
                <Plus className="h-3 w-3 mr-1 text-emerald-400" />
                Start Blank Custom Schema
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewTab('personas')}
                className="h-7 text-xs border-purple-500/30 text-purple-300 bg-purple-950/20 hover:bg-purple-900/30 cursor-pointer"
              >
                <Users className="h-3 w-3 mr-1" />
                View User Roles
              </Button>
            </div>
          </div>

          {/* Quick Starting Templates (6 SOC-Focused Profiles) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-400">
                1. Select SOC Profile or Baseline Template
              </span>
              <span className="text-[11px] text-zinc-500">
                Pick a baseline or freely customize any field below
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {TEMPLATES.map((tpl) => {
                const isSelected = activeTemplate === tpl.id;
                return (
                  <button
                    key={tpl.id}
                    onClick={() => handleApplyTemplate(tpl)}
                    className={`p-3 rounded-lg text-left transition-all border cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-500/10 border-emerald-500/40 shadow-xs ring-1 ring-emerald-500/30'
                        : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold ${isSelected ? 'text-emerald-400' : 'text-zinc-200'}`}>
                          {tpl.name}
                        </span>
                      </div>
                      {isSelected ? (
                        <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 shrink-0">
                          {tpl.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                      {tpl.desc}
                    </p>
                    <div className="mt-2.5 flex items-center justify-between text-[10px] font-mono text-zinc-500 border-t border-zinc-800/80 pt-2">
                      <span>{tpl.activeIds.length} fields active</span>
                      <span className="text-emerald-400/80">Click to apply</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2-Column: Field Selection Table on Left, Live Output Preview on Right */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Field Customizer (7 Cols) */}
            <div className="lg:col-span-7 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-400">
                  2. Customize Output Fields ({activeFieldIds.size} of {schemaFields.length} Active)
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="emerald"
                    size="sm"
                    onClick={() => setIsAddingField(true)}
                    className="h-7 text-xs px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add Custom Field
                  </Button>
                  <span className="text-zinc-600">•</span>
                  <button
                    onClick={() => {
                      setActiveTemplate('');
                      setActiveFieldIds(new Set(schemaFields.map((f) => f.id)));
                    }}
                    className="text-[11px] text-emerald-400 hover:underline cursor-pointer font-mono"
                  >
                    Select All
                  </button>
                  <span className="text-zinc-600">•</span>
                  <button
                    onClick={() => {
                      setActiveTemplate('');
                      setActiveFieldIds(new Set());
                    }}
                    className="text-[11px] text-zinc-400 hover:text-zinc-200 cursor-pointer font-mono"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              {/* Add Custom Field Inline Box */}
              {isAddingField && (
                <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-950/10 space-y-2.5 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                      <Plus className="h-3.5 w-3.5" />
                      Add Custom Enrichment / Telemetry Field
                    </span>
                    <button
                      onClick={() => setIsAddingField(false)}
                      className="text-xs text-zinc-400 hover:text-zinc-200 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <div>
                      <label className="text-[10px] text-zinc-400 font-mono block mb-1">Target JSON Key *</label>
                      <input
                        type="text"
                        placeholder="e.g. asset_criticality"
                        value={newFieldKey}
                        onChange={(e) => setNewFieldKey(e.target.value)}
                        className="w-full px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-zinc-200 font-mono text-xs focus:border-emerald-500 outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-400 font-mono block mb-1">Display Label</label>
                      <input
                        type="text"
                        placeholder="e.g. Asset Criticality Tier"
                        value={newFieldLabel}
                        onChange={(e) => setNewFieldLabel(e.target.value)}
                        className="w-full px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-zinc-200 text-xs focus:border-emerald-500 outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-400 font-mono block mb-1">Sample Value</label>
                      <input
                        type="text"
                        placeholder="e.g. TIER-1_PROD"
                        value={newFieldSample}
                        onChange={(e) => setNewFieldSample(e.target.value)}
                        className="w-full px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-zinc-200 font-mono text-xs focus:border-emerald-500 outline-hidden"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end pt-1">
                    <Button
                      variant="emerald"
                      size="sm"
                      onClick={handleAddCustomField}
                      disabled={!newFieldKey.trim()}
                      className="h-7 text-xs px-3 bg-emerald-600 hover:bg-emerald-500"
                    >
                      Add Field & Enable
                    </Button>
                  </div>
                </div>
              )}

              {/* Table of Fields */}
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 overflow-hidden">
                <Table>
                  <TableHeader className="bg-zinc-900/80">
                    <TableRow>
                      <TableHead className="w-12 text-center">Include</TableHead>
                      <TableHead className="text-[10px] font-mono uppercase">Field / Source</TableHead>
                      <TableHead className="text-[10px] font-mono uppercase">Target JSON Key (Editable)</TableHead>
                      <TableHead className="text-[10px] font-mono uppercase hidden sm:table-cell">Canonical Path</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {schemaFields.map((field) => {
                      const isIncluded = activeFieldIds.has(field.id);
                      const currentKey = fieldKeyNames[field.id] || field.defaultKey;

                      return (
                        <TableRow
                          key={field.id}
                          className={`transition-colors ${
                            isIncluded ? 'bg-emerald-950/10 hover:bg-emerald-950/20' : 'opacity-60 hover:opacity-100'
                          }`}
                        >
                          <TableCell className="text-center">
                            <input
                              type="checkbox"
                              checked={isIncluded}
                              onChange={() => handleToggleField(field.id)}
                              className="rounded border-zinc-700 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-zinc-900 cursor-pointer"
                            />
                          </TableCell>
                          <TableCell>
                            <div className="font-semibold text-xs text-zinc-200 flex items-center gap-1.5">
                              {field.label}
                              {field.isCustom && (
                                <Badge variant="outline" className="text-[9px] px-1 py-0 border-purple-500/40 text-purple-400">
                                  Custom
                                </Badge>
                              )}
                            </div>
                            <span className="text-[11px] text-zinc-400 block leading-tight mt-0.5">
                              {field.description}
                            </span>
                          </TableCell>
                          <TableCell>
                            <input
                              type="text"
                              value={currentKey}
                              onChange={(e) => handleKeyRename(field.id, e.target.value)}
                              placeholder={field.defaultKey}
                              className="font-mono text-xs px-2 py-1 rounded bg-zinc-950 border border-zinc-700 text-emerald-400 focus:border-emerald-500 focus:outline-hidden w-full max-w-[200px]"
                            />
                          </TableCell>
                          <TableCell className="font-mono text-[11px] text-zinc-400 hidden sm:table-cell">
                            {field.canonicalPath}
                          </TableCell>
                          <TableCell className="text-right">
                            {field.isCustom && (
                              <button
                                onClick={() => handleRemoveCustomField(field.id)}
                                className="p-1 rounded text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 transition-colors"
                                title="Remove Custom Field"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Right Column: Live Output Preview (5 Cols) */}
            <div className="lg:col-span-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                  Live Standardized Output Preview
                </span>
                <span className="text-[10px] font-mono text-emerald-400">Updates in real-time</span>
              </div>

              <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 space-y-3 shadow-xl">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-900">
                  <span className="text-xs font-mono text-zinc-400">
                    Format: <span className="text-zinc-200">Standardized JSON</span>
                  </span>
                  <button
                    onClick={handleCopyJson}
                    className="px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-[11px] font-mono text-zinc-300 flex items-center gap-1.5 cursor-pointer transition-colors border border-zinc-800"
                  >
                    {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    {copied ? 'Copied!' : 'Copy JSON'}
                  </button>
                </div>

                <pre className="font-mono text-xs text-emerald-300/90 leading-relaxed overflow-x-auto max-h-[420px] select-all bg-zinc-900/30 p-3 rounded border border-zinc-900">
                  {JSON.stringify(livePayload, null, 2)}
                </pre>

                <div className="pt-2 border-t border-zinc-900 space-y-2">
                  <Button
                    variant="emerald"
                    className="w-full text-xs font-semibold h-9 cursor-pointer"
                    onClick={handleSaveProfile}
                  >
                    {saveSuccess ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-1.5" />
                        Output Schema Saved as Active!
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-1.5" />
                        Save as Active Output Schema
                      </>
                    )}
                  </Button>
                  <p className="text-[10px] text-zinc-500 text-center leading-normal">
                    All incoming perimeter events from Cisco, Palo Alto, Fortinet, and Check Point will be emitted matching this custom structure.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : viewTab === 'personas' ? (
        /* Enterprise Personas & ULPF Alignment View */
        <div className="space-y-6">
          {/* Persona Header Banner */}
          <div className="p-4 rounded-lg border border-purple-500/30 bg-purple-950/20 space-y-2">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-400" />
              <h2 className="text-sm font-semibold text-purple-300">
                Enterprise Stakeholders & User Roles (ULPF Framework Alignment)
              </h2>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed max-w-4xl">
              Modern enterprises generate massive volumes of logs across network devices, servers, OS, containers, and IAM in diverse formats (Syslog, JSON, XML, CSV, CEF, LEEF, proprietary vendor formats). The Universal Log Pre-processing Framework (ULPF) solves critical challenges across the 7 distinct enterprise user roles identified below:
            </p>
          </div>

          {/* Grid of 7 Personas */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ENTERPRISE_PERSONAS.map((persona) => (
              <Card key={persona.id} className="border-zinc-800 bg-zinc-900/60 flex flex-col justify-between hover:border-zinc-700 transition-all">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                        {persona.role}
                      </CardTitle>
                      <span className="text-[10px] font-mono text-zinc-400 mt-0.5 block">
                        {persona.department}
                      </span>
                    </div>
                    <Badge variant="outline" className={`text-[9px] uppercase font-mono px-2 py-0.5 ${persona.badgeColor}`}>
                      {persona.id.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </div>
                  <p className="text-xs text-zinc-300 mt-2 leading-relaxed">
                    {persona.mission}
                  </p>
                </CardHeader>

                <CardContent className="space-y-3 pt-0 flex-1 flex flex-col justify-between">
                  <div className="space-y-2.5">
                    {/* Pain Points */}
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-rose-400 font-semibold block mb-1">
                        Core Pain Points Solved
                      </span>
                      <ul className="space-y-1 text-[11px] text-zinc-400 leading-normal">
                        {persona.painPoints.map((pt, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="text-rose-400 font-bold shrink-0">•</span>
                            <span>{pt}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* ULPF Capability Alignment */}
                    <div className="p-2.5 rounded-md bg-zinc-950 border border-zinc-800/80">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-semibold block mb-1 flex items-center gap-1">
                        <Shield className="h-3 w-3" />
                        ULPF Solution Alignment
                      </span>
                      <p className="text-[11px] text-zinc-300 leading-relaxed">
                        {persona.ulpfSolution}
                      </p>
                    </div>

                    {/* Expected Outcomes */}
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-semibold block mb-1">
                        Expected Outcomes
                      </span>
                      <ul className="space-y-1 text-[11px] text-zinc-300">
                        {persona.expectedOutcomes.map((out, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                            <span>{out}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Recommended Profile Action */}
                  <div className="pt-3 border-t border-zinc-800/80 mt-3 space-y-2">
                    <div className="text-[10px] text-zinc-400 font-mono flex items-center justify-between">
                      <span>Tailored Schema:</span>
                      <span className="text-purple-300 font-semibold">{persona.recommendedProfileName}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleLoadPersonaProfile(persona.recommendedProfileId)}
                      className="w-full h-8 text-xs font-medium border-purple-500/30 text-purple-300 bg-purple-950/20 hover:bg-purple-900/30 cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      Load Profile & Open Builder
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Comprehensive ULPF Requirements Matrix (a-k) */}
          <div className="p-4 rounded-lg border border-zinc-800 bg-zinc-900/40 space-y-3">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-200 flex items-center gap-2">
              <FileCheck className="h-4 w-4 text-emerald-400" />
              ULPF Expected Solution Requirements Matrix (a through k)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
              <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800/80">
                <span className="font-mono text-emerald-400 font-bold block mb-0.5">(a) Lossless Raw Preservation</span>
                <p className="text-[11px] text-zinc-400">Complete raw event data preserved byte-for-byte in the envelope with zero data loss.</p>
              </div>
              <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800/80">
                <span className="font-mono text-emerald-400 font-bold block mb-0.5">(b) Common Event Taxonomy</span>
                <p className="text-[11px] text-zinc-400">Normalizes vendor fields into a standardized schema (timestamp, IP, port, action, severity).</p>
              </div>
              <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800/80">
                <span className="font-mono text-emerald-400 font-bold block mb-0.5">(c) Diverse Format Support</span>
                <p className="text-[11px] text-zinc-400">Parses Syslog, JSON, XML, CSV, CEF, LEEF, and proprietary vendor text patterns.</p>
              </div>
              <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800/80">
                <span className="font-mono text-emerald-400 font-bold block mb-0.5">(d) Bi-Directional Traceability</span>
                <p className="text-[11px] text-zinc-400">Cryptographic SHA-256 wire seal links normalized records directly back to original raw bytes.</p>
              </div>
              <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800/80">
                <span className="font-mono text-emerald-400 font-bold block mb-0.5">(e) Plug-and-Play Onboarding</span>
                <p className="text-[11px] text-zinc-400">Zero-code addition of new firewall and network appliances through automated grammar extraction.</p>
              </div>
              <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800/80">
                <span className="font-mono text-emerald-400 font-bold block mb-0.5">(f) Unified Visibility</span>
                <p className="text-[11px] text-zinc-400">Centralized operational oversight across heterogeneous perimeters without vendor silos.</p>
              </div>
              <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800/80">
                <span className="font-mono text-emerald-400 font-bold block mb-0.5">(g) Resilient Parsing & Drift</span>
                <p className="text-[11px] text-zinc-400">Zero-day drift quarantine with AI explanation and human-in-the-loop schema patching.</p>
              </div>
              <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800/80">
                <span className="font-mono text-emerald-400 font-bold block mb-0.5">(h) AI/ML Analytics Ready</span>
                <p className="text-[11px] text-zinc-400">Real-time projection into numerical feature vectors for anomaly models and behavioral clustering.</p>
              </div>
              <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800/80">
                <span className="font-mono text-emerald-400 font-bold block mb-0.5">(i) Reduced Engineering Effort</span>
                <p className="text-[11px] text-zinc-400">Eliminates repetitive manual regex authoring and parser maintenance across firmware upgrades.</p>
              </div>
              <div className="p-2.5 rounded bg-zinc-950 border border-emerald-500/40">
                <span className="font-mono text-emerald-400 font-bold block mb-0.5">(j) Air-Gapped Network Ready</span>
                <p className="text-[11px] text-zinc-400">100% offline self-contained operation with zero external internet telemetry dependencies.</p>
              </div>
              <div className="p-2.5 rounded bg-zinc-950 border border-emerald-500/40">
                <span className="font-mono text-emerald-400 font-bold block mb-0.5">(k) Containerized Independence</span>
                <p className="text-[11px] text-zinc-400">Packaged into Docker/OCI containers for platform independence across Linux, on-prem, and clouds.</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Knowledge Registry View */
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-lg bg-zinc-900/50 border border-zinc-800">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
              <input
                type="text"
                placeholder="Search vendor mappings..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-md bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-hidden focus:border-emerald-500/50"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="h-3.5 w-3.5 text-zinc-500" />
              <select
                value={vendorFilter}
                onChange={(e) => setVendorFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-md bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 focus:outline-hidden cursor-pointer"
              >
                <option value="all">All Vendors</option>
                <option value="cisco_asa">Cisco ASA</option>
                <option value="palo_alto">Palo Alto</option>
                <option value="fortinet_fortigate">Fortinet</option>
                <option value="checkpoint_quantum">Check Point</option>
                <option value="snort_ids">Snort IDS</option>
              </select>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 overflow-hidden">
            <Table>
              <TableHeader className="bg-zinc-900/80">
                <TableRow>
                  <TableHead className="text-[10px] font-mono uppercase">Vendor & Product</TableHead>
                  <TableHead className="text-[10px] font-mono uppercase">Firmware / Version</TableHead>
                  <TableHead className="text-[10px] font-mono uppercase">Format</TableHead>
                  <TableHead className="text-[10px] font-mono uppercase">Rules Count</TableHead>
                  <TableHead className="text-[10px] font-mono uppercase">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMappings.map((m) => (
                  <TableRow key={m.mapping_id}>
                    <TableCell className="font-semibold text-xs text-zinc-200">
                      {m.product}
                      <span className="block text-[10px] text-zinc-500 font-mono capitalize">
                        {m.vendor.replace('_', ' ')}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-zinc-300">{m.software_version}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] font-mono uppercase">
                        {m.format}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-emerald-400">
                      {m.rules.length} field rules
                    </TableCell>
                    <TableCell>
                      <Badge variant="success" className="text-[9px] font-mono uppercase">
                        {m.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
};
