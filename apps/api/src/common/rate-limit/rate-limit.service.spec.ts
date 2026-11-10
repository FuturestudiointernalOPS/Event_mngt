import { describe, expect, it } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { Env } from '../../config/env.validation';
import type { AuthenticatedRequest } from '../types/authenticated-request';
import type { RateLimitOptions } from './rate-limit.decorator';
import { RateLimitGuard } from './rate-limit.guard';
import type { RateLimitRepository } from './rate-limit.repository';
import type { RateLimiterService } from './rate-limit.service';
import { RateLimiterService as Service } from './rate-limit.service';

function buildLimiter(limit = 2): Service {
  const counts = new Map<string, number>();

  const repository = {
    increment: async (key: string) => {
      const next = (counts.get(key) ?? 0) + 1;
      counts.set(key, next);
      return next;
    },
  } as unknown as RateLimitRepository;

  const config = {
    get: (key: string) => (key === 'RATE_LIMIT_DEFAULT_LIMIT' ? limit : 60),
  } as unknown as ConfigService<Env, true>;

  return new Service(config, repository);
}

describe('RateLimiterService', () => {
  it('allows the budget and refuses the next request in the same window', async () => {
    const limiter = buildLimiter(2);

    await expect(limiter.consume('bucket:ip:1.2.3.4')).resolves.toMatchObject({
      allowed: true,
      remaining: 1,
    });
    await expect(limiter.consume('bucket:ip:1.2.3.4')).resolves.toMatchObject({
      allowed: true,
      remaining: 0,
    });

    const refused = await limiter.consume('bucket:ip:1.2.3.4');
    expect(refused.allowed).toBe(false);
    expect(refused.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });

  it('keeps buckets independent', async () => {
    const limiter = buildLimiter(1);

    expect((await limiter.consume('a:ip:1')).allowed).toBe(true);
    expect((await limiter.consume('b:ip:1')).allowed).toBe(true);
  });
});

function context(body: unknown = {}, ip = '203.0.113.7'): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({
      getRequest: () =>
        ({ ip, body, headers: {} }) as unknown as AuthenticatedRequest,
    }),
  } as unknown as ExecutionContext;
}

function guard(
  options: RateLimitOptions[] | undefined,
  allowed = true,
): RateLimitGuard {
  const reflector = {
    getAllAndOverride: () => options,
  } as unknown as Reflector;

  const limiter = {
    consume: async () => ({ allowed, remaining: 0, retryAfterSeconds: 12 }),
  } as unknown as RateLimiterService;

  return new RateLimitGuard(reflector, limiter);
}

describe('RateLimitGuard', () => {
  it('passes through when the route declares no budget', async () => {
    await expect(guard(undefined).canActivate(context())).resolves.toBe(true);
  });

  it('passes when the caller is inside the budget', async () => {
    await expect(
      guard([{ bucket: 'login', key: 'ip' }]).canActivate(context()),
    ).resolves.toBe(true);
  });

  it('refuses with a stable code and a Retry-After value', async () => {
    const error = await guard([{ bucket: 'login', key: 'ip' }], false)
      .canActivate(context())
      .catch((caught: unknown) => caught);

    expect(error).toMatchObject({
      code: 'rate_limited',
      headers: { 'Retry-After': '12' },
    });
  });

  it('skips an email bucket when the request has no address', async () => {
    await expect(
      guard([{ bucket: 'login', key: 'email' }], false).canActivate(context({})),
    ).resolves.toBe(true);
  });
});
