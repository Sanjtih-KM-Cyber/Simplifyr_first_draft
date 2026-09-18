/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CommonEventEnvelope, LogFormat } from '../types.ts';

/**
 * Pure JavaScript synchronous SHA-256 implementation.
 * Guarantees zero async latency for high-throughput in-memory pre-processing.
 */
export function calculateSha256(str: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let i = 0;
  let j = 0;

  const result: number[] = [];
  const words: number[] = [];
  const asciiBitLength = str.length * 8;

  // Initial hash values: first 32 bits of the fractional parts of square roots of first 8 primes
  let hash: number[] = [];
  // Round constants: first 32 bits of fractional parts of cube roots of first 64 primes
  const k: number[] = [];

  let primeCounter = 0;
  const isComposite: Record<number, boolean> = {};

  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (let composite = candidate * candidate; composite < 312; composite += candidate) {
        isComposite[composite] = true;
      }
      if (primeCounter < 8) {
        hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      }
      k[primeCounter] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      primeCounter++;
    }
  }

  for (i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    words[i >> 2] |= (code & 0xff) << (24 - (i % 4) * 8);
  }

  words[asciiBitLength >> 5] |= 0x80 << (24 - (asciiBitLength % 32));
  words[(((asciiBitLength + 64) >> 9) << 4) + 15] = asciiBitLength;

  for (i = 0; i < words.length; i += 16) {
    const w = words.slice(i, i + 16);
    const oldHash = hash.slice(0);

    for (j = 0; j < 64; j++) {
      if (j >= 16) {
        const s0 = rightRotate(w[j - 15], 7) ^ rightRotate(w[j - 15], 18) ^ (w[j - 15] >>> 3);
        const s1 = rightRotate(w[j - 2], 17) ^ rightRotate(w[j - 2], 19) ^ (w[j - 2] >>> 10);
        w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
      }

      const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
      const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
      const s0 = rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22);
      const s1 = rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25);

      const temp1 = (hash[7] + s1 + ch + k[j] + w[j]) | 0;
      const temp2 = (s0 + maj) | 0;

      hash = [(temp1 + temp2) | 0, hash[0], hash[1], hash[2], (hash[3] + temp1) | 0, hash[4], hash[5], hash[6]];
    }

    for (j = 0; j < 8; j++) {
      hash[j] = (hash[j] + oldHash[j]) | 0;
    }
  }

  for (i = 0; i < 8; i++) {
    for (j = 3; j >= 0; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result.push(b);
    }
  }

  return result.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a unique UUID v4
 */
export function generateEventId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Creates a Common Event Envelope wrapping untransformed raw log data.
 */
export function createCommonEventEnvelope(
  rawPayload: string,
  sourceInfo?: Partial<CommonEventEnvelope['ingestion_source']>,
  contentType: LogFormat = 'unknown',
  metadata: Record<string, unknown> = {}
): CommonEventEnvelope {
  const cleanPayload = rawPayload.trim();
  const sha256 = calculateSha256(cleanPayload);

  return {
    event_id: generateEventId(),
    received_at: new Date().toISOString(),
    sha256_hash: sha256,
    raw_payload: cleanPayload,
    content_type: contentType,
    ingestion_source: {
      device_id: sourceInfo?.device_id || 'FW-UNKNOWN',
      ip_address: sourceInfo?.ip_address || '127.0.0.1',
      protocol: sourceInfo?.protocol || 'file',
      port: sourceInfo?.port || 514,
    },
    metadata: {
      payload_bytes: cleanPayload.length,
      ...metadata,
    },
  };
}

/**
 * Verifies that the raw payload has not suffered bit rot or tampering.
 */
export function verifyEnvelopeIntegrity(envelope: CommonEventEnvelope): boolean {
  const recalculated = calculateSha256(envelope.raw_payload);
  return recalculated.toLowerCase() === envelope.sha256_hash.toLowerCase();
}
