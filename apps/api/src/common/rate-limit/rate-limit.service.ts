import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.validation';
import { RateLimitRepository } from './rate-limit.repository';
import { retryAfterSeconds, windowStart } from './rate-limit.rules';

export interface ConsumeOptions {
  limit?: number;
  windowSeconds?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * The counting half of rate limiting. Limits come from configuration, so tuning them
 * never means editing a guard or a decorator.
 */
@Injectable()
export class RateLimiterService {
  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly repository: RateLimitRepository,
  ) {}

  async consume(key: string, options: ConsumeOptions = {}): Promise<RateLimitResult> {
    const windowSeconds =
      options.windowSeconds ??
      this.config.get('RATE_LIMIT_DEFAULT_WINDOW_SECONDS', { infer: true });
    const limit =
      options.limit ?? this.config.get('RATE_LIMIT_DEFAULT_LIMIT', { infer: true });

    const now = new Date();
    const startedAt = windowStart(now, windowSeconds);
    const count = await this.repository.increment(key, startedAt);
    const allowed = count <= limit;

    return {
      allowed,
      remaining: Math.max(0, limit - count),
      retryAfterSeconds: allowed
        ? 0
        : retryAfterSeconds(now, startedAt, windowSeconds),
    };
  }
}
