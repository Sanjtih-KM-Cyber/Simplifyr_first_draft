/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ParsedEvent } from '../../types.ts';

/**
 * JSON Log Parser
 * Parses valid JSON payloads and flattens nested structures into dot-notation keys.
 */
export function parseJson(raw: string, eventId: string): ParsedEvent {
  const tokens: ParsedEvent['raw_tokens'] = [];
  let parsedJson: Record<string, unknown> = {};

  try {
    let cleanRaw = raw.trim();
    // In case JSON is wrapped in a Syslog header: <134>1 ... { ... }
    const firstBrace = cleanRaw.indexOf('{');
    const lastBrace = cleanRaw.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleanRaw = cleanRaw.substring(firstBrace, lastBrace + 1);
    }

    parsedJson = JSON.parse(cleanRaw);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Invalid JSON string';
    return {
      event_id: eventId,
      format: 'json',
      header: {},
      fields: { raw_payload: raw },
      raw_tokens: [{ value: raw }],
      parser_name: 'JsonParser',
      parser_version: '1.3.0',
      parsing_errors: [errorMsg],
    };
  }

  const flattenedFields: Record<string, unknown> = {};

  function flatten(obj: Record<string, unknown>, prefix = '') {
    for (const [key, value] of Object.entries(obj)) {
      const fullPath = prefix ? `${prefix}.${key}` : key;
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        flatten(value as Record<string, unknown>, fullPath);
      } else {
        flattenedFields[fullPath] = value;
        tokens.push({
          key: fullPath,
          value: typeof value === 'string' ? value : JSON.stringify(value),
        });
      }
    }
  }

  flatten(parsedJson);

  return {
    event_id: eventId,
    format: 'json',
    header: {
      timestamp: (flattenedFields['timestamp'] || flattenedFields['time'] || flattenedFields['@timestamp']) as string | undefined,
      hostname: (flattenedFields['host'] || flattenedFields['hostname']) as string | undefined,
    },
    fields: flattenedFields,
    raw_tokens: tokens,
    parser_name: 'JsonParser',
    parser_version: '1.3.0',
  };
}
