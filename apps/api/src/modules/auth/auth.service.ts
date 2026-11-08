import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  AuthUser,
  CurrentUserResponse,
  LoginRequest,
  MembershipSummary,
  RegisterRequest,
  SessionSummary,
} from '@event-platform/shared';
import {
  MemberStatus,
  OrganizationStatus,
  UserStatus,
  VerificationTokenType,
} from '@prisma/client';
import * as argon2 from 'argon2';
import { AppException } from '../../common/app-exception';
import {
  generateOpaqueToken,
  hashOpaqueToken,
  ttlToSeconds,
} from '../../common/utils/tokens';
import { AppConfigService } from '../../config/config.module';
import { PrismaService } from '../../database/prisma.service';
import { EMAIL_PORT } from '../../integrations/email/email.port';
import type { EmailPort } from '../../integrations/email/email.port';

/** Argon2id parameters. Recorded here so they can be raised deliberately over time. */
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

const USER_SELECT = {
  id: true,
  email: true,
  displayName: true,
  isPlatformAdmin: true,
  status: true,
} as const;

type UserRecord = {
  id: string;
  email: string;
  displayName: string | null;
  isPlatformAdmin: boolean;
  status: UserStatus;
};

export interface SessionMeta {
  userAgent?: string | null;
  ipAddress?: string | null;
}

export interface LoginResult {
  session: {
    user: AuthUser;
    memberships: MembershipSummary[];
    accessToken: string;
    expiresIn: number;
  };
  refreshToken: string;
}

export interface RefreshedSession {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
}

/**
 * Custom authentication — Supabase Auth is not used anywhere.
 * See docs/04-authentication-and-sessions.md for the design and rationale.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: AppConfigService,
    @Inject(EMAIL_PORT) private readonly email: EmailPort,
  ) {}

  async register(input: RegisterRequest): Promise<{ accepted: true }> {
    const existing = await this.prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });

    if (existing) {
      throw AppException.conflict(
        'conflict',
        'An account with this email already exists.',
      );
    }

    const passwordHash = await argon2.hash(input.password, ARGON2_OPTIONS);

    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        displayName: input.displayName ?? null,
        status: UserStatus.PENDING_VERIFICATION,
      },
      select: { id: true, email: true },
    });

    const token = await this.issueVerificationToken(
      user.id,
      VerificationTokenType.EMAIL_VERIFICATION,
      24,
    );

    const verificationUrl = `${this.config.get('WEB_APP_URL', { infer: true })}/verify-email?token=${token}`;

    await this.email.send({
      to: user.email,
      subject: 'Verify your email address',
      text: [
        'Welcome to the Event Platform.',
        '',
        'Confirm your email address to activate your account:',
        verificationUrl,
        '',
        'This link can be used once and expires in 24 hours.',
      ].join('\n'),
    });

    return { accepted: true };
  }

  async verifyEmail(token: string): Promise<{ verified: true }> {
    const record = await this.prisma.verificationToken.findUnique({
      where: { tokenHash: hashOpaqueToken(token) },
    });

    if (!record) {
      throw AppException.badRequest(
        'invalid_token',
        'This verification link is invalid or has expired.',
      );
    }

    const isUsable =
      record.type === VerificationTokenType.EMAIL_VERIFICATION &&
      record.consumedAt === null &&
      record.expiresAt > new Date();

    if (!isUsable) {
      throw AppException.badRequest(
        'invalid_token',
        'This verification link is invalid or has expired.',
      );
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { status: UserStatus.ACTIVE, emailVerifiedAt: new Date() },
      }),
      this.prisma.verificationToken.update({
        where: { id: record.id },
        data: { consumedAt: new Date() },
      }),
    ]);

    return { verified: true };
  }

  async login(input: LoginRequest, meta: SessionMeta): Promise<LoginResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
      select: { ...USER_SELECT, passwordHash: true },
    });

    if (!user) {
      // Equalise timing so the endpoint does not reveal whether an account exists.
      await argon2.hash(input.password, ARGON2_OPTIONS);
      throw AppException.unauthorized(
        'invalid_credentials',
        'Email or password is incorrect.',
      );
    }

    const passwordMatches = await argon2
      .verify(user.passwordHash, input.password)
      .catch(() => false);

    if (!passwordMatches) {
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

    const accessToken = await this.signAccessToken(user, session.id);

    return {
      session: {
        user: toAuthUser(user),
        memberships: await this.loadMemberships(user.id),
        accessToken,
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
      memberships: await this.loadMemberships(user.id),
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

    return sessions.map((session) => ({
      id: session.id,
      userAgent: session.userAgent,
      ipAddress: session.ipAddress,
      createdAt: session.createdAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
      current: session.id === currentSessionId,
    }));
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

  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, status: true },
    });

    // Always resolve the same way: never reveal whether an account exists.
    if (!user || user.status === UserStatus.SUSPENDED) {
      return;
    }

    const token = await this.issueVerificationToken(
      user.id,
      VerificationTokenType.PASSWORD_RESET,
      0.5,
    );

    const resetUrl = `${this.config.get('WEB_APP_URL', { infer: true })}/reset-password?token=${token}`;

    await this.email.send({
      to: user.email,
      subject: 'Reset your password',
      text: [
        'A password reset was requested for this account.',
        '',
        resetUrl,
        '',
        'This link can be used once and expires in 30 minutes.',
        'If you did not request this, no action is required.',
      ].join('\n'),
    });
  }

  async resetPassword(token: string, password: string): Promise<void> {
    const record = await this.prisma.verificationToken.findUnique({
      where: { tokenHash: hashOpaqueToken(token) },
    });

    if (!record) {
      throw AppException.badRequest(
        'invalid_token',
        'This reset link is invalid or has expired.',
      );
    }

    const isUsable =
      record.type === VerificationTokenType.PASSWORD_RESET &&
      record.consumedAt === null &&
      record.expiresAt > new Date();

    if (!isUsable) {
      throw AppException.badRequest(
        'invalid_token',
        'This reset link is invalid or has expired.',
      );
    }

    const passwordHash = await argon2.hash(password, ARGON2_OPTIONS);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
      this.prisma.verificationToken.update({
        where: { id: record.id },
        data: { consumedAt: new Date() },
      }),
      this.prisma.userSession.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  private async issueVerificationToken(
    userId: string,
    type: VerificationTokenType,
    ttlHours: number,
  ): Promise<string> {
    const token = generateOpaqueToken();

    await this.prisma.verificationToken.create({
      data: {
        userId,
        type,
        tokenHash: hashOpaqueToken(token),
        expiresAt: new Date(Date.now() + ttlHours * 3_600_000),
      },
    });

    return token;
  }

  private async loadMemberships(userId: string): Promise<MembershipSummary[]> {
    const memberships = await this.prisma.organizationMember.findMany({
      where: {
        userId,
        status: MemberStatus.ACTIVE,
        organization: { status: OrganizationStatus.ACTIVE },
      },
      orderBy: { createdAt: 'asc' },
      select: {
        organization: { select: { id: true, slug: true, name: true } },
        role: {
          select: {
            key: true,
            permissions: { select: { permission: { select: { key: true } } } },
          },
        },
      },
    });

    return memberships.map((membership) => ({
      organizationId: membership.organization.id,
      organizationSlug: membership.organization.slug,
      organizationName: membership.organization.name,
      roleKey: membership.role.key,
      permissions: membership.role.permissions.map((entry) => entry.permission.key),
    }));
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

function toAuthUser(user: UserRecord): AuthUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    isPlatformAdmin: user.isPlatformAdmin,
  };
}
