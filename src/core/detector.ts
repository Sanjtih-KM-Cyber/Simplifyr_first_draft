/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DetectionResult, LogFormat, ParsedEvent, PerimeterVendor } from '../types.ts';
import { parseCef } from './parsers/cef.ts';
import { parseCsv } from './parsers/csv.ts';
import { parseJson } from './parsers/json.ts';
import { parseKeyValue } from './parsers/keyvalue.ts';
import { parseLeef } from './parsers/leef.ts';
import { parseSyslog } from './parsers/syslog.ts';

/**
 * Format & Vendor Heuristic Detection Engine
 * Uses deterministic structural fingerprints, regex, and protocol markers.
 */
export function detectLogFormatAndVendor(raw: string): DetectionResult {
  const clean = raw.trim();
  const indicators: string[] = [];

  let format: LogFormat = 'unknown';
  let formatConfidence = 0.5;

  let vendor: PerimeterVendor = 'unknown';
  let vendorConfidence = 0.5;
  let deviceProduct = 'Generic Gateway';
  let eventFamily = 'Network Event';

  // --- 1. FORMAT DETECTION ---
  if (clean.includes('CEF:')) {
    format = 'cef';
    formatConfidence = 0.99;
    indicators.push('CEF signature detected (CEF:0|...)');
  } else if (clean.includes('LEEF:')) {
    format = 'leef';
    formatConfidence = 0.99;
    indicators.push('LEEF signature detected (LEEF:1.0|...)');
  } else if (
    (clean.startsWith('{') && clean.endsWith('}')) ||
    (clean.includes('{') && clean.includes('}') && clean.includes('"'))
  ) {
    try {
      const first = clean.indexOf('{');
      const last = clean.lastIndexOf('}');
      JSON.parse(clean.substring(first, last + 1));
      format = 'json';
      formatConfidence = 0.98;
      indicators.push('Valid JSON structure detected');
    } catch {
      // not strict JSON, fallback to syslog or keyvalue
    }
  }

  if (format === 'unknown') {
    if (clean.match(/^<\d{1,3}>/)) {
      if (clean.match(/^<\d{1,3}>\d+\s+\d{4}-\d{2}-\d{2}T/)) {
        format = 'syslog_rfc5424';
        formatConfidence = 0.97;
        indicators.push('Syslog RFC 5424 format with ISO timestamp & version');
      } else {
        format = 'syslog_rfc3164';
        formatConfidence = 0.95;
        indicators.push('Syslog RFC 3164 format with PRI & BSD timestamp');
      }
    } else if (clean.includes('=') && (clean.includes(' ') || clean.includes(';'))) {
      format = 'keyvalue';
      formatConfidence = 0.9;
      indicators.push('Key-Value pair delimiter format');
    } else if (clean.split(',').length > 6) {
      format = 'csv';
      formatConfidence = 0.85;
      indicators.push('Comma-separated value stream format');
    }
  }

  // --- 2. VENDOR & PRODUCT DETECTION ---
  const lower = clean.toLowerCase();

  // Cisco ASA / Firepower
  if (
    clean.includes('%ASA-') ||
    lower.includes('cisco') ||
    clean.includes('Built outbound TCP') ||
    clean.includes('Teardown TCP connection')
  ) {
    vendor = 'cisco_asa';
    vendorConfidence = 0.98;
    deviceProduct = 'Cisco ASA 5500-X / Secure Firewall';
    eventFamily = 'Firewall Traffic';
    indicators.push('Cisco ASA message pattern (%ASA-6-302013 or conn teardown)');
  }
  // Palo Alto Networks PAN-OS
  else if (
    lower.includes('pan-os') ||
    lower.includes('paloalto') ||
    lower.includes('palo alto') ||
    clean.includes(',TRAFFIC,') ||
    clean.includes(',THREAT,')
  ) {
    vendor = 'palo_alto';
    vendorConfidence = 0.97;
    deviceProduct = 'Palo Alto PA-Series (PAN-OS)';
    eventFamily = clean.includes('THREAT') ? 'Threat Prevention' : 'Firewall Traffic';
    indicators.push('Palo Alto PAN-OS log signature or TRAFFIC/THREAT token');
  }
  // Fortinet FortiGate FortiOS
  else if (
    lower.includes('fortigate') ||
    lower.includes('fortinet') ||
    clean.includes('devname="FGT') ||
    clean.includes('devname=FGT') ||
    clean.includes('logid="00000000')
  ) {
    vendor = 'fortinet_fortigate';
    vendorConfidence = 0.98;
    deviceProduct = 'Fortinet FortiGate (FortiOS)';
    eventFamily = 'UTM & Firewall Traffic';
    indicators.push('Fortinet device ID (devname=FGT...) or FortiOS logid');
  }
  // Check Point Quantum
  else if (
    lower.includes('checkpoint') ||
    lower.includes('check point') ||
    lower.includes('fw_1') ||
    clean.includes('product=VPN-1') ||
    clean.includes('product=SmartDefense')
  ) {
    vendor = 'checkpoint_quantum';
    vendorConfidence = 0.95;
    deviceProduct = 'Check Point Quantum Security Gateway';
    eventFamily = 'Firewall Connection';
    indicators.push('Check Point Quantum / FW-1 signature');
  }
  // Snort / Suricata IDS
  else if (
    clean.includes('[**] [') ||
    lower.includes('snort') ||
    lower.includes('suricata') ||
    clean.includes('[Classification:')
  ) {
    vendor = 'snort_ids';
    vendorConfidence = 0.96;
    deviceProduct = 'Snort / Suricata Network IDS';
    eventFamily = 'Intrusion Detection Alert';
    indicators.push('Snort fast-alert rule header format [**] [GID:SID:REV]');
  }
  // Generic Firewall
  else if (
    clean.includes('src=') ||
    clean.includes('srcip=') ||
    clean.includes('dst=') ||
    clean.includes('dstip=') ||
    clean.includes('action=') ||
    clean.includes('proto=')
  ) {
    vendor = 'generic_firewall';
    vendorConfidence = 0.88;
    deviceProduct = 'Generic Perimeter Firewall';
    eventFamily = 'Firewall Traffic';
    indicators.push('Standard IP perimeter parameters (src, dst, proto, action)');
  }

  return {
    format,
    format_confidence: formatConfidence,
    vendor,
    vendor_confidence: vendorConfidence,
    device_product: deviceProduct,
    event_family: eventFamily,
    detected_indicators: indicators,
  };
}

/**
 * Universal Parser Router
 * Parses any incoming raw payload using the best suited modular parser.
 */
export function parseAnyLog(rawPayload: string, eventId: string): ParsedEvent {
  const detection = detectLogFormatAndVendor(rawPayload);

  switch (detection.format) {
    case 'cef':
      return parseCef(rawPayload, eventId);
    case 'leef':
      return parseLeef(rawPayload, eventId);
    case 'json':
      return parseJson(rawPayload, eventId);
    case 'csv':
      return parseCsv(rawPayload, eventId);
    case 'keyvalue':
      return parseKeyValue(rawPayload, eventId);
    case 'syslog_rfc5424':
    case 'syslog_rfc3164':
    default:
      return parseSyslog(rawPayload, eventId);
  }
}
