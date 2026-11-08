import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { AppConfigService } from '../../config/config.module';
import { AppException } from '../app-exception';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { AccessTokenPayload, AuthenticatedUser } from '../types/authenticated-user';
import type { AuthenticatedRequest } from '../types/authenticated-request';

/**
 * Verifies the short-lived access token and attaches `request.user`.
 *
 * The token carries no tenant and no permissions: both are resolved per request so
 * role changes and membership removal take effect immediately. See
 * docs/04-authentication-and-sessions.md.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly config: AppConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractToken(request);

    if (!token) {
      throw AppException.unauthorized('unauthorized', 'Sign in to continue.');
    }

    try {
      const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
      });

      if (payload.typ !== 'access') {
        throw new Error('Unexpected token type');
      }

      const user: AuthenticatedUser = {
        id: payload.sub,
        email: payload.email,
        sessionId: payload.sid,
        isPlatformAdmin: payload.pad === true,
      };
      request.user = user;

      return true;
    } catch {
      throw AppException.unauthorized(
        'token_expired',
        'Your session has expired. Please sign in again.',
      );
    }
  }

  private extractToken(request: AuthenticatedRequest): string | undefined {
    const header = request.headers.authorization;
    if (!header) {
      return undefined;
    }
    const [scheme, value] = header.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !value) {
      return undefined;
    }
    return value;
  }
}
