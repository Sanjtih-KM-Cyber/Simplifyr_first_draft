/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// ============================================================================
// SIMPLIFYR / ULPF (Universal Log Pre-processing Framework) TYPE DEFINITIONS
// ============================================================================

/**
 * 1. Common Event Envelope
 * Lossless transport envelope wrapping any incoming event before downstream processing.
 */
export interface CommonEventEnvelope {
  event_id: string;                         // Unique UUID v4
  received_at: string;                      // ISO-8601 UTC timestamp
  sha256_hash: string;                      // Cryptographic proof of untouched raw payload
  raw_payload: string;                      // Original event string, 100% untouched
  content_type: LogFormat;                  // Detected format family
  ingestion_source: {
    device_id: string;                      // Device identifier (e.g. "FW-Perimeter-01")
    ip_address: string;                     // Ingestion origin IP (e.g. "192.168.1.10")
    protocol: 'syslog' | 'http' | 'file' | 'kafka' | 'stream_sim';
    port?: number;
  };
  metadata: Record<string, unknown>;
}

export type LogFormat =
  | 'syslog_rfc5424'
  | 'syslog_rfc3164'
  | 'cef'
  | 'leef'
  | 'json'
  | 'keyvalue'
  | 'csv'
  | 'unknown';

export type PerimeterVendor =
  | 'cisco_asa'
  | 'palo_alto'
  | 'fortinet_fortigate'
  | 'checkpoint_quantum'
  | 'snort_ids'
  | 'generic_firewall'
  | 'unknown';

/**
 * 2. Parsed Event (Structural Stage)
 * The output of a modular parser before semantic interpretation.
 * Answers: "How do I structurally read this event?"
 */
export interface ParsedEvent {
  event_id: string;
  format: LogFormat;
  header: {
    priority?: number;
    facility?: number;
    severity?: number | string;
    timestamp?: string;
    hostname?: string;
    app_name?: string;
    process_id?: string;
    message_id?: string;
  };
  fields: Record<string, unknown>;          // Extracted key-value pairs
  raw_tokens: Array<{
    key?: string;
    value: string;
    raw_slice?: { start: number; end: number };
  }>;
  parser_name: string;
  parser_version: string;
  parsing_errors?: string[];
}

/**
 * 3. Canonical Semantic Event (Semantic Stage)
 * Internal product abstraction representing normalized perimeter concepts.
 * Answers: "What does this field mean in common taxonomy?"
 */
export interface CanonicalSemanticEvent {
  event_id: string;
  timestamp: string;
  device: {
    vendor: string;
    product: string;
    version: string;
    hostname?: string;
    device_id: string;
  };
  source: {
    ip: string;
    port?: number;
    zone?: string;
    nat_ip?: string;
    nat_port?: number;
  };
  destination: {
    ip: string;
    port?: number;
    zone?: string;
    nat_ip?: string;
    nat_port?: number;
  };
  network: {
    protocol: 'TCP' | 'UDP' | 'ICMP' | 'GRE' | 'OTHER';
    action: 'ALLOWED' | 'BLOCKED' | 'ALERT' | 'UNKNOWN';
    bytes_in?: number;
    bytes_out?: number;
    packets?: number;
    session_id?: string;
    application?: string;
    interface_in?: string;
    interface_out?: string;
  };
  threat?: {
    severity: 'INFORMATIONAL' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    signature?: string;
    category?: string;
    cve?: string;
  };
  auth?: {
    user?: string;
    domain?: string;
    status?: 'SUCCESS' | 'FAILURE';
  };
  metadata?: Record<string, unknown>;
}

/**
 * 4. Provenance & Forensic Traceability
 * Links every normalized value back to its source token and mapping rule.
 * Answers: "Where did this value come from?"
 */
export interface FieldProvenance {
  output_field: string;
  output_value: unknown;
  original_field: string;
  original_value: unknown;
  mapping_rule: string;
  mapping_version: string;
  confidence: number;
  raw_slice?: { start: number; end: number };
}

export interface EventProvenance {
  event_id: string;
  sha256_hash: string;
  source_device: string;
  detected_format: LogFormat;
  detected_vendor: PerimeterVendor;
  parser_version: string;
  mapping_version: string;
  lineage: Record<string, FieldProvenance>;
  processed_at: string;
  latency_ms: number;
}

/**
 * 5. Format & Vendor Detection Result
 */
export interface DetectionResult {
  format: LogFormat;
  format_confidence: number;
  vendor: PerimeterVendor;
  vendor_confidence: number;
  device_product?: string;
  event_family?: string;
  detected_indicators: string[];
}

/**
 * 6. Knowledge Registry: Versioned Mappings
 */
export interface FieldMappingRule {
  input_field: string;
  semantic_field: string;
  transformation_type: 'identity' | 'enum' | 'regex' | 'cast';
  enum_map?: Record<string, string>;
  confidence: number;
}

export interface VersionedMapping {
  mapping_id: string;
  vendor: PerimeterVendor;
  product: string;
  software_version: string;
  event_family: string;
  format: LogFormat;
  rules: FieldMappingRule[];
  status: 'active' | 'deprecated' | 'testing';
  created_at: string;
  approved_by: string;
  change_notes?: string;
}

/**
 * 7. Output Profiles
 */
export interface OutputProfile {
  id: string;
  name: string;
  description: string;
  is_preset: boolean;
  fields_to_include: string[];
  key_rename_map?: Record<string, string>;
  format: 'json' | 'flat_json';
}

/**
 * 8. Schema Drift & Quarantine
 */
export interface SchemaDriftRecord {
  drift_id: string;
  device_id: string;
  vendor: PerimeterVendor;
  product: string;
  detected_at: string;
  quarantined_event_ids: string[];
  sample_raw_event: string;
  structural_diff: {
    missing_fields: string[];
    new_fields: string[];
    renamed_candidates: Array<{ old_field: string; new_field: string }>;
  };
  ai_analysis?: {
    likely_cause: 'software_update' | 'new_vendor' | 'new_event_type' | 'malformed';
    confidence: number;
    suggested_version: string;
    suggested_rules: FieldMappingRule[];
    reasoning: string;
  };
  status: 'pending_review' | 'approved' | 'rejected';
}

/**
 * 9. Subsystem Telemetry Metrics
 */
export interface TelemetryMetrics {
  events_per_second: number;
  avg_latency_ms: number;
  total_processed: number;
  quarantined_count: number;
  dlq_count: number;
  lossless_rate_pct: number;
  health: {
    ingestion: 'healthy' | 'degraded' | 'down';
    processing: 'healthy' | 'degraded' | 'down';
    storage: 'healthy' | 'degraded' | 'down';
    ai_engine: 'healthy' | 'degraded' | 'down';
  };
}

/**
 * 10. Processed Live Stream Event (Phase 4)
 */
export interface ProcessedStreamEvent {
  id: string;
  timestamp: string;
  relativeTime: string;
  raw: string;
  envelope: CommonEventEnvelope;
  detection: DetectionResult;
  parsed: ParsedEvent;
  mapping: VersionedMapping;
  canonical: CanonicalSemanticEvent;
  provenance: EventProvenance;
  unmappedFields: Record<string, unknown>;
  latencyMs: number;
  isDrift: boolean;
  isAttack: boolean;
  attackType?: string;
  driftReason?: string;
}

/**
 * 11. Phase 5: Structural Fingerprint & Drift Engine
 */
export interface StructuralFingerprint {
  fingerprintHash: string;
  vendor: PerimeterVendor;
  format: LogFormat;
  version: string;
  extractedTokenKeys: string[];
  tokenTypes: Record<string, 'ipv4' | 'ipv6' | 'port' | 'integer' | 'enum' | 'string' | 'hex' | 'boolean' | 'timestamp' | 'object'>;
  tokenCount: number;
  sampleRaw: string;
  detectedAt: string;
}

export interface SchemaDiffToken {
  token: string;
  status: 'MATCHED' | 'NOVEL_UNMAPPED' | 'MISSING_EXPECTED' | 'TYPE_MISMATCH';
  mappedTo?: string;
  sampleValue?: unknown;
  inferredType?: string;
  confidence?: number;
  ruleType?: string;
  suggestedTarget?: string;
}

export interface SchemaDiffResult {
  fingerprint: StructuralFingerprint;
  baseMappingId: string;
  baseVersion: string;
  matchedCount: number;
  novelCount: number;
  missingCount: number;
  tokens: SchemaDiffToken[];
  driftScore: number; // 0.0 - 1.0 (e.g. 0.28 = 28% drift)
  driftSeverity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NEGLIGIBLE';
  assessment: 'BACKWARD_COMPATIBLE' | 'MINOR_EXTENSION' | 'PARTIAL_BREAKING' | 'STRUCTURAL_OVERHAUL';
}

/**
 * 12. Phase 5: Prompt Sandboxing & Gemini AI Analysis
 */
export interface PromptSandboxReport {
  originalLength: number;
  sanitizedLength: number;
  sanitizationFlags: string[];
  isMaliciousCandidate: boolean;
  isolationDelimiters: {
    open: string;
    close: string;
  };
  sandboxedPromptText: string;
}

export interface SuggestedRulePatch {
  input_field: string;
  semantic_field: string;
  transformation_type: 'identity' | 'cast' | 'enum' | 'regex';
  enum_map?: Record<string, string>;
  confidence: number;
  rationale: string;
  sampleValue?: unknown;
}

export interface GeminiDriftAnalysisResponse {
  vendor: PerimeterVendor;
  product: string;
  currentVersion: string;
  proposedVersion: string;
  summary: string;
  rootCauseAnalysis: string;
  suggestedRulePatches: SuggestedRulePatch[];
  securityRiskAssessment: string;
  backwardsCompatible: boolean;
  executionTimeMs: number;
  modelUsed: string;
  source: 'gemini-live' | 'deterministic-sandbox';
  sandboxReport: PromptSandboxReport;
}

/**
 * 13. Phase 5: Quarantine Buffer & Reprocess
 */
export type QuarantineStatus =
  | 'QUARANTINED'
  | 'ANALYZING'
  | 'PATCH_READY'
  | 'REPROCESSED'
  | 'DISCARDED';

export interface QuarantinedEvent {
  id: string;
  quarantinedAt: string;
  event: ProcessedStreamEvent;
  status: QuarantineStatus;
  quarantineReason: string;
  fingerprint: StructuralFingerprint;
  diffResult: SchemaDiffResult;
  aiAnalysis?: GeminiDriftAnalysisResponse;
  reprocessedEvent?: ProcessedStreamEvent;
  reprocessedAt?: string;
  appliedPatchVersion?: string;
  reprocessNotes?: string;
}

export interface ReprocessResult {
  success: boolean;
  quarantinedEventId: string;
  appliedMappingId: string;
  appliedVersion: string;
  reprocessedEvent: ProcessedStreamEvent;
  previousUnmappedCount: number;
  newUnmappedCount: number;
  reprocessedAt: string;
  message: string;
}
