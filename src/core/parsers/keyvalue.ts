/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ParsedEvent } from '../../types.ts';

/**
 * Key-Value Parser
 * Handles spaces or comma/semicolon delimited key=value or key:value strings,
 * with quote escaping (e.g. Fortinet FortiOS logs, iptables, Checkpoint FW-1).
 */
export function parseKeyValue(raw: string, eventId: string): ParsedEvent {
  const fields: Record<string, unknown> = {};
  const tokens: ParsedEvent['raw_tokens'] = [];

  // Match key=value where value can be quoted ("..." or '...') or unquoted
  const kvRegex = /([a-zA-Z0-9_.-]+)=(?:"([^"]*)"|'([^']*)'|(\S+))/g;
  let match: RegExpExecArray | null;

  while ((match = kvRegex.exec(raw)) !== null) {
    const key = match[1];
    const val = match[2] ?? match[3] ?? match[4] ?? '';
    const num = Number(val);
    fields[key] = isNaN(num) || val === '' ? val : num;
    tokens.push({
      key,
      value: val,
      raw_slice: { start: match.index, end: match.index + match[0].length },
    });
  }

  // If no key=value found, check key: value
  if (tokens.length === 0) {
    const colonRegex = /([a-zA-Z0-9_.-]+):\s+(?:"([^"]*)"|'([^']*)'|([^,\n]+))/g;
    while ((match = colonRegex.exec(raw)) !== null) {
      const key = match[1];
      const val = (match[2] ?? match[3] ?? match[4] ?? '').trim();
      const num = Number(val);
      fields[key] = isNaN(num) || val === '' ? val : num;
      tokens.push({
        key,
        value: val,
        raw_slice: { start: match.index, end: match.index + match[0].length },
      });
    }
  }

  return {
    event_id: eventId,
    format: 'keyvalue',
    header: {},
    fields,
    raw_tokens: tokens,
    parser_name: 'KeyValueParser',
    parser_version: '1.2.0',
    parsing_errors: tokens.length === 0 ? ['No key-value pairs identified'] : undefined,
  };
}
