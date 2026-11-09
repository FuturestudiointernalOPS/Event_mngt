import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * TOTP (RFC 6238, HMAC-SHA1, 6 digits, 30 s) and base32 (RFC 4648), the format every
 * authenticator app understands. Implemented here because it is small, has published test
 * vectors, and avoids a dependency on a security-sensitive path.
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export const TOTP_PERIOD_SECONDS = 30;

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += ALPHABET[(value << (5 - bits)) & 31];
  }
  return out;
}

export function base32Decode(text: string): Buffer {
  const clean = text.replace(/=+$/g, '').replace(/\s+/g, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const index = ALPHABET.indexOf(char);
    if (index === -1) {
      throw new Error('Invalid base32 input');
    }
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function newTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function timeStep(at: Date): number {
  return Math.floor(at.getTime() / 1000 / TOTP_PERIOD_SECONDS);
}

export function totpAt(secretBase32: string, step: number, digits = 6): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = createHmac('sha1', base32Decode(secretBase32)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return (binary % 10 ** digits).toString().padStart(digits, '0');
}

/**
 * Returns the matching time step (so the caller can refuse a replay of the same or an
 * earlier step), or null. Accepts one step either side to tolerate clock drift.
 */
export function verifyTotp(
  secretBase32: string,
  code: string,
  now: Date,
  lastAcceptedStep: number | null,
): number | null {
  if (!/^\d{6}$/.test(code)) {
    return null;
  }
  const current = timeStep(now);
  for (const step of [current - 1, current, current + 1]) {
    if (step < 0 || (lastAcceptedStep !== null && step <= lastAcceptedStep)) {
      continue;
    }
    const expected = Buffer.from(totpAt(secretBase32, step));
    const given = Buffer.from(code);
    if (expected.length === given.length && timingSafeEqual(expected, given)) {
      return step;
    }
  }
  return null;
}

export function otpauthUrl(secretBase32: string, account: string, issuer: string): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  return `otpauth://totp/${label}?secret=${secretBase32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${TOTP_PERIOD_SECONDS}`;
}
