import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { CurrentUserResponse, LoginRequest, SessionSummary } from '@event-platform/shared';
import { AppException } from '../../common/app-exception';
import { AUDIT_ACTIONS } from '../../common/audit/audit.actions';
import { AuditService } from '../../common/audit/audit.service';
import { generateOpaqueToken, hashOpaqueToken, ttlToSeconds } from '../../common/utils/tokens';
import type { Env } from '../../config/env.validation';
import { UserStatus } from '../../database/prisma-client';
import { PrismaService } from '../../database/prisma.service';
import { toAuthUser, toSessionSummary, USER_SELECT, type UserRecord } from './auth.mapper';
import type { LoginResult, RefreshedSession, SessionMeta } from './auth.types';
import { AccountMembershipsService } from './account-memberships.service';
import { equaliseTiming, verifyPassword } from './credentials';
import { MfaService } from './mfa.service';

/**
 * Session lifecycle: sign in, rotate, sign out, list and revoke.
 *
 * Custom authentication — Supabase Auth is not used anywhere. Account creation and
 * password recovery live in AuthRegistrationService. See docs/04.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<Env, true>,
    private readonly memberships: AccountMembershipsService,
    private readonly audit: AuditService,
    private readonly mfa: MfaService,
  ) {}

  async login(input: LoginRequest, meta: SessionMeta): Promise<LoginResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
      select: { ...USER_SELECT, passwordHash: true },
    });

    if (!user) {
      await equaliseTiming(input.password);
      throw AppException.unauthorized(
        'invalid_credentials',
        'Email or password is incorrect.',
      );
    }

    if (!(await verifyPassword(user.passwordHash, input.password))) {
      throw AppException.unauthorized(
        'invalid_credentials',
        'Email or password is incorrect.',
      );
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw AppException.forbidden(
        'account_suspended',
        'This account is suspended. Contact the platform administrator.',
      );
    }

    if (user.status === UserStatus.PENDING_VERIFICATION) {
      throw AppException.forbidden(
        'email_not_verified',
        'Verify your email address before signing in.',
      );
    }

    // The password is correct; a second factor, when enabled, must be verified before
    // any session row or token exists.
    await this.mfa.assertLoginAllowed(user.id, input.mfaCode);

    const refreshToken = generateOpaqueToken();

    const session = await this.prisma.userSession.create({
      data: {
        userId: user.id,
        refreshTokenHash: hashOpaqueToken(refreshToken),
        expiresAt: this.refreshExpiry(),
        userAgent: meta.userAgent ?? null,
        ipAddress: meta.ipAddress ?? null,
      },
      select: { id: true },
    });

    await this.audit.record({
      action: AUDIT_ACTIONS.signedIn,
      targetType: 'user',
      targetId: user.id,
      actorUserId: user.id,
      ipAddress: meta.ipAddress ?? null,
    });

    return {
      session: {
        user: toAuthUser(user),
        memberships: await this.memberships.list(user.id),
        accessToken: await this.signAccessToken(user, session.id),
        expiresIn: this.accessTokenTtlSeconds(),
      },
      refreshToken,
    };
  }

  /**
   * Rotates the refresh token. Reuse of an already-rotated token is treated as
   * compromise: every session for the account is revoked.
   */
  async refresh(rawToken: string, meta: SessionMeta): Promise<RefreshedSession> {
    const session = await this.prisma.userSession.findUnique({
      where: { refreshTokenHash: hashOpaqueToken(rawToken) },
      include: { user: { select: USER_SELECT } },
    });

    if (!session) {
      throw AppException.unauthorized(
        'invalid_refresh_token',
        'Your session has ended. Please sign in again.',
      );
    }

    if (session.revokedAt) {
      await this.revokeAllSessions(session.userId);
      throw AppException.unauthorized(
        'refresh_reuse_detected',
        'For your security, all sessions were signed out. Please sign in again.',
      );
    }

    if (session.expiresAt <= new Date()) {
      throw AppException.unauthorized(
        'token_expired',
        'Your session has expired. Please sign in again.',
      );
    }

    if (session.user.status !== UserStatus.ACTIVE) {
      throw AppException.forbidden(
        'account_inactive',
        'This account cannot start a new session.',
      );
    }

    const nextToken = generateOpaqueToken();

    const created = await this.prisma.$transaction(async (tx) => {
      await tx.userSession.update({
        where: { id: session.id },
        data: { revokedAt: new Date(), lastUsedAt: new Date() },
      });

      return tx.userSession.create({
        data: {
          userId: session.userId,
          refreshTokenHash: hashOpaqueToken(nextToken),
          expiresAt: this.refreshExpiry(),
          userAgent: meta.userAgent ?? session.userAgent,
          ipAddress: meta.ipAddress ?? session.ipAddress,
        },
        select: { id: true },
      });
    });

    await this.prisma.userSession.update({
      where: { id: session.id },
      data: { replacedBySessionId: created.id },
    });

    return {
      accessToken: await this.signAccessToken(session.user, created.id),
      expiresIn: this.accessTokenTtlSeconds(),
      refreshToken: nextToken,
    };
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) {
      return;
    }

    await this.prisma.userSession.updateMany({
      where: { refreshTokenHash: hashOpaqueToken(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async me(userId: string): Promise<CurrentUserResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: USER_SELECT,
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw AppException.unauthorized('unauthorized', 'Sign in to continue.');
    }

    return {
      user: toAuthUser(user),
      memberships: await this.memberships.list(user.id),
    };
  }

  async listSessions(userId: string, currentSessionId: string): Promise<SessionSummary[]> {
    const sessions = await this.prisma.userSession.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        userAgent: true,
        ipAddress: true,
        createdAt: true,
        expiresAt: true,
      },
    });

    return sessions.map((session) => toSessionSummary(session, currentSessionId));
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const result = await this.prisma.userSession.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    if (result.count === 0) {
      throw AppException.notFound('not_found', 'Session not found.');
    }
  }

  private async revokeAllSessions(userId: string): Promise<void> {
    await this.prisma.userSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async signAccessToken(user: UserRecord, sessionId: string): Promise<string> {
    return this.jwtService.signAsync({
      sub: user.id,
      sid: sessionId,
      email: user.email,
      typ: 'access',
      pad: user.isPlatformAdmin,
    });
  }

  private accessTokenTtlSeconds(): number {
    return ttlToSeconds(this.config.get('JWT_ACCESS_TTL', { infer: true }));
  }

  private refreshExpiry(): Date {
    const days = this.config.get('REFRESH_TOKEN_TTL_DAYS', { infer: true });
    return new Date(Date.now() + days * 86_400_000);
  }
}
