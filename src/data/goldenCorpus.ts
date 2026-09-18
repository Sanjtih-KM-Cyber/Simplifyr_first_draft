/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LogFormat, PerimeterVendor } from '../types.ts';

export interface GoldenSample {
  id: string;
  name: string;
  vendor: PerimeterVendor;
  format: LogFormat;
  device: string;
  description: string;
  raw: string;
}

export const GOLDEN_CORPUS: GoldenSample[] = [
  {
    id: 'cisco-asa-01',
    name: 'Cisco ASA Connection Built',
    vendor: 'cisco_asa',
    format: 'syslog_rfc3164',
    device: 'Cisco ASA 5585-X',
    description: 'Outbound HTTPS connection built through firewall inside to outside zone.',
    raw: '<134>Sep 17 21:14:02 asa-perimeter-01 %ASA-6-302013: Built outbound TCP connection 9841221 for outside:198.51.100.24/443 (198.51.100.24/443) to inside:10.10.4.12/54210 (10.10.4.12/54210)',
  },
  {
    id: 'palo-alto-traffic-01',
    name: 'Palo Alto PAN-OS Traffic Drop',
    vendor: 'palo_alto',
    format: 'syslog_rfc5424',
    device: 'Palo Alto PA-5250 (PAN-OS 10.2)',
    description: 'Firewall traffic log dropping non-standard port probe from external source.',
    raw: '<14>1 2026-09-17T21:18:44.123Z pa-gw01.corp PAN-OS - - - 1,2026/09/17 21:18:44,001801000100,TRAFFIC,drop,2304,2026/09/17 21:18:44,203.0.113.88,10.0.1.105,0.0.0.0,0.0.0.0,Rule-Block-Untrusted,,,web-browsing,vsys1,untrust,trust,ethernet1/1,ethernet1/2,default,2026/09/17 21:18:44,14201,1,51423,8080,0,0,0x0,tcp,deny,66,66,0,1,2026/09/17 21:18:44,0,any,0,84102941,0x0',
  },
  {
    id: 'fortinet-cef-01',
    name: 'Fortinet FortiGate CEF Drop',
    vendor: 'fortinet_fortigate',
    format: 'cef',
    device: 'FortiGate 600E (FortiOS 7.2)',
    description: 'CEF formatted forward traffic event blocked by perimeter security policy.',
    raw: 'CEF:0|Fortinet|FortiGate|v7.2.4|0000000013|traffic:forward|3|deviceExternalId=FGT60E4Q17001021 src=10.0.4.55 spt=49152 dst=192.0.2.1 dpt=53 proto=17 act=deny app=DNS msg="Traffic dropped by policy 14"',
  },
  {
    id: 'checkpoint-leef-01',
    name: 'Check Point Quantum LEEF Alert',
    vendor: 'checkpoint_quantum',
    format: 'leef',
    device: 'Check Point Quantum Security Gateway R81.20',
    description: 'LEEF formatted firewall drop event for malicious IP sweep.',
    raw: 'LEEF:1.0|Check Point|VPN-1 & FireWall-1|R81.20|drop|src=198.51.100.199\tdst=10.0.2.5\tspt=3812\tdpt=22\tproto=6\taction=drop\tsvc=ssh\trule=DefaultDrop',
  },
  {
    id: 'snort-ids-01',
    name: 'Snort Network IDS Exploit Alert',
    vendor: 'snort_ids',
    format: 'syslog_rfc3164',
    device: 'Snort 3.1 Perimeter Sensor',
    description: 'Signature match for potential remote buffer overflow probe.',
    raw: '<131>Sep 17 21:22:19 ids-sensor-01 snort[4122]: [**] [1:2010935:3] ET EXPLOIT Potential Apache HTTP Server Path Traversal [**] [Classification: Web Attack] [Priority: 1] {TCP} 198.51.100.14:48123 -> 10.0.1.80:80',
  },
  {
    id: 'generic-json-01',
    name: 'Cloud Perimeter Gateway (JSON)',
    vendor: 'generic_firewall',
    format: 'json',
    device: 'Cloud Next-Gen Gateway',
    description: 'Cloud ingress gateway JSON log with nested connection details.',
    raw: '{"version":"1.0","timestamp":"2026-09-17T21:25:00Z","device_id":"gw-cloud-01","connection":{"src_ip":"198.51.100.99","dst_ip":"10.0.3.15","src_port":61022,"dst_port":443,"protocol":"TCP"},"policy":{"name":"DefaultEgress","action":"ALLOW","bytes":4096}}',
  },
  {
    id: 'fortinet-kv-01',
    name: 'Fortinet FortiOS KV Forward',
    vendor: 'fortinet_fortigate',
    format: 'keyvalue',
    device: 'FortiGate 100F (FortiOS 7.2)',
    description: 'Key-value formatted perimeter forward traffic session log.',
    raw: 'date=2026-09-17 time=21:30:15 devname="FGT-CORP-GW" logid="0000000013" type="traffic" subtype="forward" level="notice" srcip=10.1.10.42 srcport=51294 dstip=172.217.16.206 dstport=443 proto=6 action="accept" policyid=4 sentbyte=1840 rcvdbyte=4920',
  },
  {
    id: 'pan-drift-ja4',
    name: 'Palo Alto PAN-OS 11.0 JA4 Drift',
    vendor: 'palo_alto',
    format: 'syslog_rfc5424',
    device: 'Palo Alto PA-3410 (PAN-OS 11.0)',
    description: 'Novel telemetry with TLS JA4 fingerprint and cloud VPC tags triggering schema drift quarantine.',
    raw: '<14>1 2026-09-18T10:14:02.000Z pa-fw-core-01 PAN-OS - - [pan@2847 src=192.168.4.88 dst=104.244.42.1 spt=54120 dpt=443 proto=tcp act=allow ja4=t13d1516h2_8daaf6152771_b4b39b563456 app_category="social-networking" cloud_vpc_id="vpc-0a817b"]',
  },
  {
    id: 'cisco-nat-drift',
    name: 'Cisco ASA NAT Egress Drift',
    vendor: 'cisco_asa',
    format: 'syslog_rfc3164',
    device: 'Cisco ASA 5525-X',
    description: 'Novel NAT egress telemetry (nat_spt, xlate_src) triggering schema drift isolation.',
    raw: 'Sep 18 10:16:45 cisco-asa-edge %ASA-6-302013: Built outbound TCP connection 9821415 for outside:198.51.100.22/443 (198.51.100.22/443) to inside:10.10.5.21/49812 (nat_spt=12901 xlate_src=203.0.113.50)',
  },
];
