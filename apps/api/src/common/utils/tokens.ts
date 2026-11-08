import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** 256 bits of entropy, URL-safe. Used for refresh tokens and single-use tokens. */
export function generateOpaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Tokens are stored hashed. SHA-256 is appropriate here because the input is already
 * high-entropy random data — unlike passwords, it does not need a slow KDF.
 */
export function hashOpaqueToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function constantTimeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

/**
 * Converts a Duration string such as `15m`, `2h`, `30d` or `45s` into seconds.
 * Used to report `expiresIn` alongside the access token.
 */
export function ttlToSeconds(ttl: string): number {
  const match = /^(\d+)\s*(s|m|h|d)$/i.exec(ttl.trim());
  if (!match) {
    throw new Error(`Unsupported TTL format: "${ttl}". Use a value such as 15m, 2h or 30d.`);
  }

  const amount = Number(match[1]);
  const unit = (match[2] ?? 's').toLowerCase();

  switch (unit) {
    case 'd':
      return amount * 86_400;
    case 'h':
      return amount * 3_600;
    case 'm':
      return amount * 60;
    default:
      return amount;
  }
}
