/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ParsedEvent } from '../../types.ts';

/**
 * Syslog Parser supporting:
 * - RFC 5424 (<PRI>VERSION TIMESTAMP HOSTNAME APP PROCID MSGID [SD] MSG)
 * - RFC 3164 (<PRI>Mmm dd hh:mm:ss HOSTNAME TAG: MSG)
 * - Cisco ASA Specific syslog formats (%ASA-X-YYYYYY: ...)
 */
export function parseSyslog(raw: string, eventId: string): ParsedEvent {
  const fields: Record<string, unknown> = {};
  const tokens: ParsedEvent['raw_tokens'] = [];
  const errors: string[] = [];

  let header: ParsedEvent['header'] = {};
  let msgBody = raw.trim();

  // 1. Extract PRI (<134>)
  const priMatch = msgBody.match(/^<(\d{1,3})>/);
  if (priMatch) {
    const pri = parseInt(priMatch[1], 10);
    const facility = Math.floor(pri / 8);
    const severity = pri % 8;
    header.priority = pri;
    header.facility = facility;
    header.severity = severity;
    fields['syslog.priority'] = pri;
    fields['syslog.facility'] = facility;
    fields['syslog.severity'] = severity;
    msgBody = msgBody.substring(priMatch[0].length).trim();
  }

  // 2. Check RFC 5424 (starts with version number, e.g. "1 2026-09-17T10:00:00Z ...")
  const rfc5424Match = msgBody.match(
    /^(\d+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)(?:\s+(\[.*?\]))?\s*(.*)$/
  );

  if (rfc5424Match) {
    header.timestamp = rfc5424Match[2];
    header.hostname = rfc5424Match[3];
    header.app_name = rfc5424Match[4];
    header.process_id = rfc5424Match[5];
    header.message_id = rfc5424Match[6];

    fields['syslog.version'] = rfc5424Match[1];
    fields['syslog.timestamp'] = rfc5424Match[2];
    fields['syslog.hostname'] = rfc5424Match[3];
    fields['syslog.app_name'] = rfc5424Match[4];
    fields['syslog.procid'] = rfc5424Match[5];
    fields['syslog.msgid'] = rfc5424Match[6];

    msgBody = rfc5424Match[8] || '';
  } else {
    // 3. Check RFC 3164 (<PRI>Mmm dd hh:mm:ss HOSTNAME TAG: MSG)
    const rfc3164Match = msgBody.match(
      /^([A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\s+(\S+)\s+([^:]+):\s*(.*)$/
    );

    if (rfc3164Match) {
      header.timestamp = rfc3164Match[1];
      header.hostname = rfc3164Match[2];
      header.app_name = rfc3164Match[3];

      fields['syslog.timestamp'] = rfc3164Match[1];
      fields['syslog.hostname'] = rfc3164Match[2];
      fields['syslog.tag'] = rfc3164Match[3];

      msgBody = rfc3164Match[4] || '';
    }
  }

  // 4. Cisco ASA Specific Pattern: %ASA-level-id: ...
  const rawOrTag = `${header.app_name || ''} ${msgBody}`;
  const asaMatch = rawOrTag.match(/%ASA-(\d)-(\d+):?\s*(.*)/i);
  if (asaMatch) {
    fields['cisco.asa_level'] = parseInt(asaMatch[1], 10);
    fields['cisco.message_id'] = `ASA-${asaMatch[1]}-${asaMatch[2]}`;
    fields['cisco.message_code'] = asaMatch[2];
    if (asaMatch[3]) {
      msgBody = asaMatch[3];
    }
  }

  // Check for standard ASA connection strings:
  // e.g., Built outbound TCP connection 9841221 for outside:198.51.100.24/443 (198.51.100.24/443) to inside:10.10.4.12/54210 (10.10.4.12/54210)
  const connMatch = msgBody.match(
    /(Built|Teardown|Denied|Deny)\s+(?:inbound|outbound)?\s*(\w+)?\s*connection\s+(\d+)\s+for\s+([a-zA-Z0-9_-]+):([0-9.]+)\/(\d+)\s*(?:\([^)]+\))?\s+to\s+([a-zA-Z0-9_-]+):([0-9.]+)\/(\d+)/i
  );
  if (connMatch) {
    const act = connMatch[1].toLowerCase();
    fields['action'] = (act === 'denied' || act === 'deny') ? 'DENY' : 'ALLOW';
    if (connMatch[2]) fields['proto'] = connMatch[2];
    fields['connection_id'] = connMatch[3];
    fields['src_zone'] = connMatch[4];
    fields['src_ip'] = connMatch[5];
    fields['src_port'] = parseInt(connMatch[6], 10);
    fields['dst_zone'] = connMatch[7];
    fields['dst_ip'] = connMatch[8];
    fields['dst_port'] = parseInt(connMatch[9], 10);
  } else {
    // Alternative ASA pattern: Deny tcp src outside:198.51.100.24/443 dst inside:10.10.4.12/54210
    const denyMatch = msgBody.match(
      /(Deny|Denied|Permit|Allowed)\s+(\w+)\s+src\s+([a-zA-Z0-9_-]+):([0-9.]+)\/(\d+)\s+dst\s+([a-zA-Z0-9_-]+):([0-9.]+)\/(\d+)/i
    );
    if (denyMatch) {
      const act = denyMatch[1].toLowerCase();
      fields['action'] = (act === 'deny' || act === 'denied') ? 'DENY' : 'ALLOW';
      fields['proto'] = denyMatch[2];
      fields['src_zone'] = denyMatch[3];
      fields['src_ip'] = denyMatch[4];
      fields['src_port'] = parseInt(denyMatch[5], 10);
      fields['dst_zone'] = denyMatch[6];
      fields['dst_ip'] = denyMatch[7];
      fields['dst_port'] = parseInt(denyMatch[8], 10);
    }
  }

  // 5. Extract key=value or key="value" pairs from the message body
  const kvRegex = /([a-zA-Z0-9_.-]+)=(?:"([^"]*)"|'([^']*)'|(\S+))/g;
  let match: RegExpExecArray | null;
  let hasPairs = false;

  while ((match = kvRegex.exec(msgBody)) !== null) {
    hasPairs = true;
    const key = match[1];
    const val = match[2] ?? match[3] ?? match[4] ?? '';
    fields[key] = isNaN(Number(val)) || val === '' ? val : Number(val);
    tokens.push({ key, value: val });
  }

  // 6. Check for comma-delimited Palo Alto PAN-OS traffic log body
  if (!hasPairs && msgBody.includes(',')) {
    const parts = msgBody.split(',').map((p) => p.trim());
    if (parts.length >= 10) {
      fields['panos.type'] = parts[3] || parts[0];
      fields['action'] = parts[8] || parts[4];
      // Check typical PAN-OS traffic indices
      if (parts[7]?.match(/^\d+\.\d+\.\d+\.\d+$/)) {
        fields['srcip'] = parts[7];
        fields['dstip'] = parts[8];
        fields['sport'] = parts[24] || parts[9];
        fields['dport'] = parts[25] || parts[10];
        fields['proto'] = parts[29] || 'tcp';
      }
    }
  }

  if (Object.keys(fields).length === 0) {
    fields['message'] = msgBody;
    tokens.push({ value: msgBody });
  }

  return {
    event_id: eventId,
    format: prfcFormat(header.timestamp, priMatch !== null),
    header,
    fields,
    raw_tokens: tokens,
    parser_name: 'SyslogParser',
    parser_version: '1.4.0',
    parsing_errors: errors.length > 0 ? errors : undefined,
  };
}

function prfcFormat(ts?: string, hasPri?: boolean): ParsedEvent['format'] {
  if (ts && ts.includes('T')) return 'syslog_rfc5424';
  return hasPri ? 'syslog_rfc3164' : 'syslog_rfc5424';
}
