import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppException } from '../app-exception';
import type { AuthenticatedRequest } from '../types/authenticated-request';
import {
  RATE_LIMIT_KEY,
  type RateLimitOptions,
} from './rate-limit.decorator';
import { emailFromBody, rateLimitKey } from './rate-limit.rules';
import { RateLimiterService } from './rate-limit.service';

/**
 * Enforces the budgets declared with @RateLimit().
 *
 * It runs after authentication, tenant resolution and permission checks, so a refused
 * request never reveals whether an account or workspace exists. Both an IP and an
 * account-identifier bucket may apply to the same route.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly limiter: RateLimiterService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride<RateLimitOptions[] | undefined>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!options || options.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    for (const option of options) {
      const value =
        option.key === 'ip'
          ? (request.ip ?? 'unknown')
          : option.key === 'user'
            ? request.user?.id
            : emailFromBody(request.body);

      if (!value) {
        continue;
      }

      const result = await this.limiter.consume(
        rateLimitKey(option.bucket, option.key, value),
        option,
      );

      if (!result.allowed) {
        throw AppException.tooManyRequests(
          'rate_limited',
          'Too many attempts. Try again shortly.',
          result.retryAfterSeconds,
        );
      }
    }

    return true;
  }
}
