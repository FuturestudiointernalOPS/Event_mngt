import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.validation';
import { parseRedisUrl, type RedisConnectionOptions } from './redis-connection';

/**
 * Typed access to the optional Redis connection. A malformed REDIS_URL fails at boot
 * instead of at the first background job.
 */
@Injectable()
export class RedisConnectionService {
  readonly options: RedisConnectionOptions | null;

  constructor(config: ConfigService<Env, true>) {
    const url = config.get('REDIS_URL', { infer: true });
    this.options = url ? parseRedisUrl(url) : null;
  }
}
