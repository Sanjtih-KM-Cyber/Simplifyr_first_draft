/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ParsedEvent } from '../../types.ts';

/**
 * CSV / Comma-Delimited Parser
 */
export function parseCsv(raw: string, eventId: string, headers?: string[]): ParsedEvent {
  const tokens: ParsedEvent['raw_tokens'] = [];
  const fields: Record<string, unknown> = {};

  const clean = raw.trim();
  const values = clean.split(',').map((v) => v.trim().replace(/^["']|["']$/g, ''));

  values.forEach((val, idx) => {
    const key = headers && headers[idx] ? headers[idx] : `col_${idx}`;
    const num = Number(val);
    fields[key] = isNaN(num) || val === '' ? val : num;
    tokens.push({ key, value: val });
  });

  return {
    event_id: eventId,
    format: 'csv',
    header: {},
    fields,
    raw_tokens: tokens,
    parser_name: 'CsvParser',
    parser_version: '1.0.0',
  };
}
