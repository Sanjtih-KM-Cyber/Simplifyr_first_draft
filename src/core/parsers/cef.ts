/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ParsedEvent } from '../../types.ts';

/**
 * Common Event Format (CEF) Parser
 * Spec: CEF:Version|Device Vendor|Device Product|Device Version|Device Event Class ID|Name|Severity|Extension
 */
export function parseCef(raw: string, eventId: string): ParsedEvent {
  const fields: Record<string, unknown> = {};
  const tokens: ParsedEvent['raw_tokens'] = [];
  const errors: string[] = [];

  const cefIndex = raw.indexOf('CEF:');
  if (cefIndex === -1) {
    return {
      event_id: eventId,
      format: 'cef',
      header: {},
      fields: { raw_message: raw },
      raw_tokens: [{ value: raw }],
      parser_name: 'CEFParser',
      parser_version: '1.2.0',
      parsing_errors: ['Not a valid CEF string (missing CEF: prefix)'],
    };
  }

  // Syslog prefix before CEF:
  const syslogPrefix = raw.substring(0, cefIndex).trim();
  const cefContent = raw.substring(cefIndex);

  // Pipe split with backslash-escape support
  const parts: string[] = [];
  let current = '';
  let escaped = false;

  for (let i = 0; i < cefContent.length; i++) {
    const char = cefContent[i];
    if (escaped) {
      current += char;
      escaped = false;
    } else if (char === '\\') {
      escaped = true;
    } else if (char === '|' && parts.length < 7) {
      parts.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  parts.push(current); // The remainder is the extension

  const cefHeader = parts[0] || ''; // CEF:0
  const version = cefHeader.replace(/^CEF:/, '');
  const vendor = parts[1] || 'Unknown';
  const product = parts[2] || 'Unknown';
  const deviceVersion = parts[3] || '';
  const eventClassId = parts[4] || '';
  const name = parts[5] || '';
  const severity = parts[6] || '0';
  const extension = parts[7] || '';

  fields['cef.version'] = version;
  fields['cef.vendor'] = vendor;
  fields['cef.product'] = product;
  fields['cef.device_version'] = deviceVersion;
  fields['cef.event_class_id'] = eventClassId;
  fields['cef.name'] = name;
  fields['cef.severity'] = severity;

  if (syslogPrefix) {
    fields['syslog.prefix'] = syslogPrefix;
  }

  // Parse Key-Value extension: key=val or key="val"
  const extRegex = /([a-zA-Z0-9_.-]+)=(?:"([^"]*)"|'([^']*)'|(\S+))/g;
  let match: RegExpExecArray | null;

  while ((match = extRegex.exec(extension)) !== null) {
    const key = match[1];
    const val = match[2] ?? match[3] ?? match[4] ?? '';
    fields[key] = isNaN(Number(val)) || val === '' ? val : Number(val);
    tokens.push({ key, value: val });
  }

  return {
    event_id: eventId,
    format: 'cef',
    header: {
      severity,
      app_name: product,
      hostname: vendor,
    },
    fields,
    raw_tokens: tokens,
    parser_name: 'CEFParser',
    parser_version: '1.2.0',
    parsing_errors: errors.length > 0 ? errors : undefined,
  };
}
