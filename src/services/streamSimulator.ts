/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ProcessedStreamEvent,
  PerimeterVendor,
  LogFormat,
} from '../types.ts';
import { createCommonEventEnvelope } from '../core/envelope.ts';
import { detectLogFormatAndVendor, parseAnyLog } from '../core/detector.ts';
import { knowledgeRegistry } from './knowledgeRegistry.ts';
import { normalizeEvent } from '../core/normalizer.ts';

// IP address pools for realistic simulation
const EXTERNAL_IPS = [
  '198.51.100.24',
  '203.0.113.88',
  '185.220.101.5',
  '194.26.29.112',
  '45.154.255.89',
  '91.240.118.172',
  '198.51.100.199',
  '198.51.100.14',
  '203.0.113.42',
  '192.0.2.140',
];

const INTERNAL_IPS = [
  '10.10.4.12',
  '10.0.1.105',
  '10.0.4.55',
  '10.0.2.5',
  '10.0.1.80',
  '10.0.3.15',
  '172.16.10.22',
  '172.16.20.100',
  '192.168.1.50',
  '10.20.30.40',
];

const ATTACK_SIGNATURES = [
  {
    name: 'ET EXPLOIT Apache Log4j JNDI RCE Attempt (CVE-2021-44228)',
    cve: 'CVE-2021-44228',
    category: 'Exploit / Remote Code Execution',
    severity: 'CRITICAL',
    port: 8080,
    proto: 'TCP',
  },
  {
    name: 'ET WEB_SERVER SQL Injection UNION SELECT Attempt in URI',
    cve: 'CWE-89',
    category: 'Web Application Attack',
    severity: 'HIGH',
    port: 443,
    proto: 'TCP',
  },
  {
    name: 'ET SCAN Potential Rapid SSH Brute Force Inbound',
    cve: 'CWE-307',
    category: 'Reconnaissance / Brute Force',
    severity: 'MEDIUM',
    port: 22,
    proto: 'TCP',
  },
  {
    name: 'ET ATTACK_RESPONSE Cobalt Strike Team Server Malleable C2 Beacon',
    cve: 'CWE-494',
    category: 'Command and Control / Malware',
    severity: 'CRITICAL',
    port: 443,
    proto: 'TCP',
  },
  {
    name: 'ET EXPLOIT Spring4Shell Remote Code Execution (CVE-2022-22965)',
    cve: 'CVE-2022-22965',
    category: 'Exploit / Remote Code Execution',
    severity: 'CRITICAL',
    port: 8443,
    proto: 'TCP',
  },
  {
    name: 'ET DNS Suspicious High-Entropy DGA Domain Query',
    cve: 'CWE-358',
    category: 'Malware DNS Exfiltration',
    severity: 'HIGH',
    port: 53,
    proto: 'UDP',
  },
];

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getFormattedDate(): { iso: string; syslogDate: string; panDate: string; timeOnly: string } {
  const now = new Date();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[now.getMonth()];
  const day = String(now.getDate()).padStart(2, ' ');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const millis = String(now.getMilliseconds()).padStart(3, '0');

  const syslogDate = `${month} ${day} ${hours}:${minutes}:${seconds}`;
  const panDate = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${hours}:${minutes}:${seconds}`;
  const timeOnly = `${hours}:${minutes}:${seconds}.${millis}`;

  return { iso: now.toISOString(), syslogDate, panDate, timeOnly };
}

/**
 * Generates a realistic raw perimeter log string across vendors.
 */
export function generateRawPerimeterLog(options?: {
  vendor?: PerimeterVendor;
  isAttack?: boolean;
  isDrift?: boolean;
}): { raw: string; isAttack: boolean; isDrift: boolean; attackType?: string; driftReason?: string } {
  const { syslogDate, panDate, iso } = getFormattedDate();
  const vendors: PerimeterVendor[] = [
    'cisco_asa',
    'palo_alto',
    'fortinet_fortigate',
    'checkpoint_quantum',
    'snort_ids',
    'generic_firewall',
  ];

  const vendor = options?.vendor || getRandomItem(vendors);
  const isAttack = options?.isAttack ?? Math.random() < 0.25; // 25% chance of attack by default
  const isDrift = options?.isDrift ?? false;

  const srcIp = isAttack ? getRandomItem(EXTERNAL_IPS) : getRandomItem(EXTERNAL_IPS);
  const dstIp = getRandomItem(INTERNAL_IPS);
  const srcPort = getRandomInt(32768, 61000);
  const dstPort = isAttack ? getRandomItem([80, 443, 8080, 8443, 22, 53]) : getRandomItem([80, 443, 53, 123, 8080]);
  const connId = getRandomInt(1000000, 9999999);

  let raw = '';
  let attackType: string | undefined;
  let driftReason: string | undefined;

  if (isAttack) {
    const attack = getRandomItem(ATTACK_SIGNATURES);
    attackType = attack.name;

    if (vendor === 'snort_ids') {
      raw = `<131>${syslogDate} ids-sensor-01 snort[${getRandomInt(1000, 9999)}]: [**] [1:${getRandomInt(2000000, 2099999)}:2] ${attack.name} [**] [Classification: ${attack.category}] [Priority: 1] {${attack.proto}} ${srcIp}:${srcPort} -> ${dstIp}:${attack.port}`;
    } else if (vendor === 'palo_alto') {
      raw = `<14>1 ${iso} pa-gw01.corp PAN-OS - - - 1,${panDate},001801000100,THREAT,drop,2304,${panDate},${srcIp},${dstIp},0.0.0.0,0.0.0.0,Rule-Threat-Block,${attack.name},,web-browsing,vsys1,untrust,trust,ethernet1/1,ethernet1/2,default,${panDate},${connId},1,${srcPort},${attack.port},0,0,0x0,tcp,reset-both,124,124,0,1,${panDate},0,any,${attack.cve},${getRandomInt(10000000, 99999999)},0x0`;
    } else if (vendor === 'fortinet_fortigate') {
      raw = `CEF:0|Fortinet|FortiGate|v7.2.4|0000000099|ips:threat|9|deviceExternalId=FGT60E4Q17001021 src=${srcIp} spt=${srcPort} dst=${dstIp} dpt=${attack.port} proto=6 act=blocked app=HTTP msg="${attack.name}" cve=${attack.cve} threat_weight=critical`;
    } else if (vendor === 'checkpoint_quantum') {
      raw = `LEEF:1.0|Check Point|VPN-1 & FireWall-1|R81.20|drop|src=${srcIp}\tdst=${dstIp}\tspt=${srcPort}\tdpt=${attack.port}\tproto=6\taction=drop\tsvc=http\trule=Block-Exploit-Signature\tattack=${attack.name}\tconfidenceLevel=9`;
    } else if (vendor === 'cisco_asa') {
      raw = `<130>${syslogDate} asa-perimeter-01 %ASA-2-106001: Inbound TCP connection denied from ${srcIp}/${srcPort} to ${dstIp}/${attack.port} flags SYN on interface outside [Exploit Probe Detected]`;
    } else {
      // generic_firewall
      raw = JSON.stringify({
        version: '1.0',
        timestamp: iso,
        device_id: 'gw-cloud-01',
        threat: {
          signature: attack.name,
          severity: attack.severity,
          cve: attack.cve,
        },
        connection: {
          src_ip: srcIp,
          dst_ip: dstIp,
          src_port: srcPort,
          dst_port: attack.port,
          protocol: 'TCP',
        },
        policy: { name: 'IDS-Active-Block', action: 'DENY', bytes: 142 },
      });
    }

    return { raw, isAttack: true, isDrift: false, attackType };
  }

  // Schema Drift Injection Case
  if (isDrift) {
    driftReason = 'Firmware update added novel telemetry attributes without schema mapping';
    if (vendor === 'fortinet_fortigate') {
      raw = `CEF:0|Fortinet|FortiGate|v7.4.2|0000000045|traffic:forward|3|deviceExternalId=FGT60E4Q17001021 src=${srcIp} spt=${srcPort} dst=${dstIp} dpt=${dstPort} proto=6 act=accept app=HTTPS x_cloud_tenant_id=tenant-east-91 ja3_fingerprint=e7d705a3286e19ea42f5fc7 flow_risk_score=12`;
    } else if (vendor === 'palo_alto') {
      raw = `<14>1 ${iso} pa-gw01.corp PAN-OS - - - 1,${panDate},001801000100,TRAFFIC,allow,2304,${panDate},${srcIp},${dstIp},0.0.0.0,0.0.0.0,Rule-Allow-Web,,,ssl,vsys1,untrust,trust,ethernet1/1,ethernet1/2,default,${panDate},${connId},1,${srcPort},${dstPort},0,0,0x0,tcp,allow,${getRandomInt(1000, 50000)},${getRandomInt(500, 20000)},0,1,${panDate},0,any,0,${getRandomInt(10000000, 99999999)},0x0,novel_cloud_vpc_id=vpc-0912fa89b,novel_tls_version=TLSv1.3`;
    } else if (vendor === 'cisco_asa') {
      raw = `<134>${syslogDate} asa-perimeter-01 %ASA-6-302013: Built outbound TCP connection ${connId} for outside:${srcIp}/${srcPort} to inside:${dstIp}/${dstPort} novel_sgt_tag=100 novel_vlan=204`;
    } else {
      raw = JSON.stringify({
        version: '2.0-beta',
        timestamp: iso,
        device_id: 'gw-cloud-01',
        connection: {
          src_ip: srcIp,
          dst_ip: dstIp,
          src_port: srcPort,
          dst_port: dstPort,
          protocol: 'TCP',
        },
        policy: { name: 'DefaultEgress', action: 'ALLOW', bytes: getRandomInt(1000, 5000) },
        novel_telemetry: {
          mesh_latency_us: 142,
          bpf_filter_id: 'xdp-0x9812',
          cloud_region: 'us-east-1',
        },
      });
    }

    return { raw, isAttack: false, isDrift: true, driftReason };
  }

  // Normal / Benign Multi-Vendor Perimeter Traffic
  switch (vendor) {
    case 'cisco_asa': {
      const isTeardown = Math.random() < 0.4;
      if (isTeardown) {
        raw = `<134>${syslogDate} asa-perimeter-01 %ASA-6-302014: Teardown TCP connection ${connId} for outside:${srcIp}/${dstPort} to inside:${dstIp}/${srcPort} duration 0:02:14 bytes ${getRandomInt(500, 30000)} TCP FINs`;
      } else {
        raw = `<134>${syslogDate} asa-perimeter-01 %ASA-6-302013: Built outbound TCP connection ${connId} for outside:${srcIp}/${dstPort} (198.51.100.24/${dstPort}) to inside:${dstIp}/${srcPort} (${dstIp}/${srcPort})`;
      }
      break;
    }

    case 'palo_alto': {
      const isAllow = Math.random() < 0.65;
      const act = isAllow ? 'allow' : 'drop';
      const rule = isAllow ? 'Rule-Web-DMZ' : 'Rule-Block-External';
      raw = `<14>1 ${iso} pa-gw01.corp PAN-OS - - - 1,${panDate},001801000100,TRAFFIC,${act},2304,${panDate},${srcIp},${dstIp},0.0.0.0,0.0.0.0,${rule},,,web-browsing,vsys1,untrust,trust,ethernet1/1,ethernet1/2,default,${panDate},${connId},1,${srcPort},${dstPort},0,0,0x0,tcp,${act},${getRandomInt(100, 2000)},${getRandomInt(100, 2000)},0,1,${panDate},0,any,0,${getRandomInt(10000000, 99999999)},0x0`;
      break;
    }

    case 'fortinet_fortigate': {
      const isAllow = Math.random() < 0.7;
      const act = isAllow ? 'accept' : 'deny';
      const proto = dstPort === 53 ? '17' : '6';
      raw = `CEF:0|Fortinet|FortiGate|v7.2.4|0000000013|traffic:forward|3|deviceExternalId=FGT60E4Q17001021 src=${srcIp} spt=${srcPort} dst=${dstIp} dpt=${dstPort} proto=${proto} act=${act} app=HTTPS in_bytes=${getRandomInt(200, 15000)} out_bytes=${getRandomInt(200, 20000)}`;
      break;
    }

    case 'checkpoint_quantum': {
      const isDrop = Math.random() < 0.35;
      const act = isDrop ? 'drop' : 'accept';
      const rule = isDrop ? 'DefaultDrop' : 'OutboundWeb';
      raw = `LEEF:1.0|Check Point|VPN-1 & FireWall-1|R81.20|${act}|src=${srcIp}\tdst=${dstIp}\tspt=${srcPort}\tdpt=${dstPort}\tproto=6\taction=${act}\tsvc=https\trule=${rule}`;
      break;
    }

    case 'snort_ids': {
      // Informational / Port scan alert
      raw = `<133>${syslogDate} ids-sensor-01 snort[${getRandomInt(1000, 9999)}]: [**] [1:2000537:8] ET INFO Potential TLS SNI Handshake [**] [Classification: Misc activity] [Priority: 3] {TCP} ${srcIp}:${srcPort} -> ${dstIp}:${dstPort}`;
      break;
    }

    case 'generic_firewall':
    default: {
      raw = JSON.stringify({
        version: '1.0',
        timestamp: iso,
        device_id: 'gw-cloud-01',
        connection: {
          src_ip: srcIp,
          dst_ip: dstIp,
          src_port: srcPort,
          dst_port: dstPort,
          protocol: dstPort === 53 ? 'UDP' : 'TCP',
        },
        policy: { name: 'DefaultEgress', action: 'ALLOW', bytes: getRandomInt(200, 8000) },
      });
      break;
    }
  }

  return { raw, isAttack: false, isDrift: false };
}

/**
 * Executes the entire deterministic pipeline for a raw perimeter log.
 */
export function processRawEventThroughPipeline(
  rawInput: string,
  extraMeta?: { isAttack?: boolean; isDrift?: boolean; attackType?: string; driftReason?: string }
): ProcessedStreamEvent {
  const startTime = performance.now();
  const { iso, timeOnly } = getFormattedDate();

  // 1. Detection
  const detection = detectLogFormatAndVendor(rawInput);

  // 2. Cryptographic Envelope
  const envelope = createCommonEventEnvelope(
    rawInput,
    {
      device_id: `FW-${detection.vendor.toUpperCase()}-01`,
      ip_address: '192.168.1.1',
      protocol: 'syslog',
    },
    detection.format
  );

  // 3. Structural Parsing
  const parsed = parseAnyLog(rawInput, envelope.event_id);

  // 4. Knowledge Registry Lookup
  const mapping =
    knowledgeRegistry.findBestMapping(detection.vendor, detection.format) ||
    knowledgeRegistry.getAllMappings()[0];

  // 5. Semantic Normalization & Lineage Tracking
  const latency = Math.max(0.12, Math.round((performance.now() - startTime) * 100) / 100);
  const normalizedResult = normalizeEvent(envelope, parsed, mapping, latency);

  // 6. Assemble Processed Stream Event
  return {
    id: envelope.event_id,
    timestamp: iso,
    relativeTime: timeOnly,
    raw: rawInput,
    envelope,
    detection,
    parsed,
    mapping,
    canonical: normalizedResult.canonical,
    provenance: normalizedResult.provenance,
    unmappedFields: normalizedResult.unmappedFields,
    latencyMs: latency,
    isDrift: extraMeta?.isDrift ?? Object.keys(normalizedResult.unmappedFields).length > 0,
    isAttack:
      extraMeta?.isAttack ??
      (normalizedResult.canonical.threat?.severity === 'CRITICAL' ||
        normalizedResult.canonical.threat?.severity === 'HIGH'),
    attackType: extraMeta?.attackType ?? normalizedResult.canonical.threat?.signature,
    driftReason: extraMeta?.driftReason,
  };
}

/**
 * Stream Simulator Controller for UI
 */
export class MultiVendorStreamSimulator {
  private timer: number | null = null;
  private isRunning: boolean = false;
  private currentEps: number = 2; // Events per second
  private onEventCallback: ((event: ProcessedStreamEvent) => void) | null = null;

  public setCallback(cb: (event: ProcessedStreamEvent) => void) {
    this.onEventCallback = cb;
  }

  public start(eps: number = 2) {
    this.currentEps = eps;
    this.isRunning = true;
    this.scheduleNextTick();
  }

  public stop() {
    this.isRunning = false;
    if (this.timer) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
  }

  public setSpeed(eps: number) {
    this.currentEps = eps;
    if (this.isRunning) {
      if (this.timer) window.clearTimeout(this.timer);
      this.scheduleNextTick();
    }
  }

  public getIsRunning(): boolean {
    return this.isRunning;
  }

  public getEps(): number {
    return this.currentEps;
  }

  public pulse(options?: { vendor?: PerimeterVendor; isAttack?: boolean; isDrift?: boolean }): ProcessedStreamEvent {
    const rawResult = generateRawPerimeterLog(options);
    const processed = processRawEventThroughPipeline(rawResult.raw, rawResult);
    if (this.onEventCallback) {
      this.onEventCallback(processed);
    }
    return processed;
  }

  private scheduleNextTick() {
    if (!this.isRunning) return;

    // Calculate delay in ms from EPS (e.g., 2 EPS = 500ms +/- 20% jitter)
    const baseInterval = 1000 / Math.max(0.2, this.currentEps);
    const jitter = (Math.random() - 0.5) * 0.2 * baseInterval;
    const interval = Math.max(50, baseInterval + jitter);

    this.timer = window.setTimeout(() => {
      this.pulse();
      this.scheduleNextTick();
    }, interval);
  }
}

export const streamSimulator = new MultiVendorStreamSimulator();
