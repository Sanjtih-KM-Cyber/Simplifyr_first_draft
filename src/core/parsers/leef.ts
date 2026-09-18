/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ParsedEvent } from '../../types.ts';

/**
 * Log Event Extended Format (LEEF) Parser
 * Spec: LEEF:Version|Vendor|Product|Version|EventID|Delimiter|Extension
 */
export function parseLeef(raw: string, eventId: string): ParsedEvent {
  const fields: Record<string, unknown> = {};
  const tokens: ParsedEvent['raw_tokens'] = [];

  const leefIndex = raw.indexOf('LEEF:');
  if (leefIndex === -1) {
    return {
      event_id: eventId,
      format: 'leef',
      header: {},
      fields: { raw_message: raw },
      raw_tokens: [{ value: raw }],
      parser_name: 'LEEFParser',
      parser_version: '1.1.0',
      parsing_errors: ['Not a valid LEEF string (missing LEEF: prefix)'],
    };
  }

  const prefix = raw.substring(0, leefIndex).trim();
  const content = raw.substring(leefIndex);

  const parts = content.split('|');
  const version = parts[0]?.replace(/^LEEF:/, '') || '1.0';
  const vendor = parts[1] || 'Unknown';
  const product = parts[2] || 'Unknown';
  const deviceVersion = parts[3] || '';
  const eventIdField = parts[4] || '';

  fields['leef.version'] = version;
  fields['leef.vendor'] = vendor;
  fields['leef.product'] = product;
  fields['leef.device_version'] = deviceVersion;
  fields['leef.event_id'] = eventIdField;

  if (prefix) {
    fields['syslog.prefix'] = prefix;
  }

  // Determine delimiter (parts[5] if version 2.0, or remainder if 1.0)
  let delimiter = '\t';
  let attributes = '';

  if (version.startsWith('2.') && parts.length >= 7) {
    const customDelim = parts[5];
    if (customDelim === 'x09' || customDelim === '\\t') {
      delimiter = '\t';
    } else if (customDelim) {
      delimiter = customDelim;
    }
    attributes = parts.slice(6).join('|');
  } else {
    attributes = parts.slice(5).join('|');
  }

  // Parse attributes
  const pairs = attributes.split(delimiter);
  for (const pair of pairs) {
    const eqIdx = pair.indexOf('=');
    if (eqIdx > 0) {
      const key = pair.substring(0, eqIdx).trim();
      const val = pair.substring(eqIdx + 1).trim();
      fields[key] = isNaN(Number(val)) || val === '' ? val : Number(val);
      tokens.push({ key, value: val });
    }
  }

  return {
    event_id: eventId,
    format: 'leef',
    header: {
      app_name: product,
      hostname: vendor,
    },
    fields,
    raw_tokens: tokens,
    parser_name: 'LEEFParser',
    parser_version: '1.1.0',
  };
}
