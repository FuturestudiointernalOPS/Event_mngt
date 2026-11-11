import { randomBytes } from 'node:crypto';

/**
 * Per-event human reference. Not a secret — it is what a participant quotes to the
 * organiser — so it only needs to be unique, readable and short.
 */

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function encodeReference(bytes: Uint8Array): string {
  let code = '';

  for (const byte of bytes) {
    code += ALPHABET[byte % ALPHABET.length];
  }

  return `EP-${code}`;
}

export function createReference(): string {
  return encodeReference(randomBytes(6));
}
