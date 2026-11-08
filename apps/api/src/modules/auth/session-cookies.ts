import { Injectable } from '@nestjs/common';
import { CSRF_COOKIE, CSRF_TOKEN_HEADER, REFRESH_TOKEN_COOKIE } from '@event-platform/shared';
import type { Request, Response } from 'express';
import { AppException } from '../../common/app-exception';
import { constantTimeEquals } from '../../common/utils/tokens';
import { AppConfigService } from '../../config/config.module';

const REFRESH_COOKIE_PATH = '/api/v1/auth';

/**
 * Refresh token and CSRF cookie handling.
 *
 * - The refresh token is HttpOnly, so JavaScript cannot read it.
 * - The CSRF token is deliberately readable (double-submit pattern) and must be sent
 *   back in the X-CSRF-Token header on refresh.
 * - Cookie path is the auth surface only, so ordinary API calls do not carry the
 *   refresh token.
 */
@Injectable()
export class AuthCookieService {
  constructor(private readonly config: AppConfigService) {}

  write(response: Response, refreshToken: string, csrfToken: string): void {
    const maxAge = this.config.get('REFRESH_TOKEN_TTL_DAYS', { infer: true }) * 86_400_000;

    response.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
      httpOnly: true,
      secure: this.isProduction(),
      sameSite: 'lax',
      domain: this.cookieDomain(),
      path: REFRESH_COOKIE_PATH,
      maxAge,
    });

    response.cookie(CSRF_COOKIE, csrfToken, {
      httpOnly: false,
      secure: this.isProduction(),
      sameSite: 'lax',
      domain: this.cookieDomain(),
      path: '/',
      maxAge,
    });
  }

  clear(response: Response): void {
    response.clearCookie(REFRESH_TOKEN_COOKIE, {
      path: REFRESH_COOKIE_PATH,
      domain: this.cookieDomain(),
    });
    response.clearCookie(CSRF_COOKIE, {
      path: '/',
      domain: this.cookieDomain(),
    });
  }

  readRefreshToken(request: Request): string | undefined {
    const value: unknown = request.cookies?.[REFRESH_TOKEN_COOKIE];
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }

  assertCsrf(request: Request): void {
    const cookieValue: unknown = request.cookies?.[CSRF_COOKIE];
    const header = request.headers[CSRF_TOKEN_HEADER];
    const headerValue = Array.isArray(header) ? header[0] : header;

    if (
      typeof cookieValue !== 'string' ||
      typeof headerValue !== 'string' ||
      !constantTimeEquals(cookieValue, headerValue)
    ) {
      throw AppException.forbidden(
        'csrf_token_invalid',
        'Your session could not be verified. Please sign in again.',
      );
    }
  }

  private isProduction(): boolean {
    return this.config.get('NODE_ENV', { infer: true }) === 'production';
  }

  private cookieDomain(): string | undefined {
    const domain = this.config.get('COOKIE_DOMAIN', { infer: true });
    return domain && domain.length > 0 ? domain : undefined;
  }
}
