import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.validation';
import { RateLimiterService } from './rate-limit.service';

const SWEEP_INTERVAL_MS = 6 * 3_600_000;

/**
 * Bounded retention for fixed-window counters. The delete is idempotent, so running it
 * on every API instance is harmless; it keeps a high-traffic deployment from accumulating
 * rate-limit rows forever.
 */
@Injectable()
export class RateLimitMaintenanceService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(RateLimitMaintenanceService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly limiter: RateLimiterService,
  ) {}

  onApplicationBootstrap(): void {
    void this.sweep();
    this.timer = setInterval(() => void this.sweep(), SWEEP_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async sweep(): Promise<void> {
    try {
      const hours = this.config.get('RATE_LIMIT_RETENTION_HOURS', { infer: true });
      await this.limiter.purgeOlderThan(hours);
    } catch (error) {
      this.logger.warn(
        `Rate-limit cleanup failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
