import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'rateLimit';

export type RateLimitKeySource = 'ip' | 'email';

export interface RateLimitOptions {
  /** A stable bucket name; changing it starts a fresh budget. */
  bucket: string;
  /** Which caller identifier the bucket is counted against. */
  key: RateLimitKeySource;
  /** Defaults come from RATE_LIMIT_DEFAULT_LIMIT / _WINDOW_SECONDS. */
  limit?: number;
  windowSeconds?: number;
}

/**
 * Applies one or more fixed-window budgets to a route (WP-08).
 *
 * Limits are configuration: the decorator names the bucket, the guard reads the
 * environment defaults. A route can carry both an IP and an account-identifier budget.
 */
export const RateLimit = (
  ...options: RateLimitOptions[]
): MethodDecorator & ClassDecorator => SetMetadata(RATE_LIMIT_KEY, options);
