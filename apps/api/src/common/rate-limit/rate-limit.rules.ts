import { createHash } from 'node:crypto';
import type { RateLimitKeySource } from './rate-limit.decorator';

/**
 * Fixed-window arithmetic and key derivation (R11).
 *
 * Account identifiers are hashed before they reach storage: the counter table must
 * never become a list of email addresses, and a refusal must not reveal whether an
 * account exists.
 */

export function windowStart(now: Date, windowSeconds: number): Date {
  const size = Math.max(1, Math.floor(windowSeconds)) * 1000;
  return new Date(Math.floor(now.getTime() / size) * size);
}

export function retryAfterSeconds(
  now: Date,
  startedAt: Date,
  windowSeconds: number,
): number {
  const endsAt = startedAt.getTime() + windowSeconds * 1000;
  return Math.max(1, Math.ceil((endsAt - now.getTime()) / 1000));
}

export function rateLimitKey(
  bucket: string,
  source: RateLimitKeySource,
  value: string,
): string {
  if (source === 'email') {
    const digest = createHash('sha256')
      .update(value.trim().toLowerCase())
      .digest('hex');
    return `${bucket}:email:${digest}`;
  }

  return `${bucket}:ip:${value.length > 0 ? value : 'unknown'}`;
}

/** Reads the account identifier from a request body without trusting its shape. */
export function emailFromBody(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null) {
    return undefined;
  }

  const value = (body as { email?: unknown }).email;
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}
