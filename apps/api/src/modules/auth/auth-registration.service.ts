import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { RegisterRequest } from '@event-platform/shared';
import { AppException } from '../../common/app-exception';
import { generateOpaqueToken, hashOpaqueToken } from '../../common/utils/tokens';
import type { Env } from '../../config/env.validation';
import { UserStatus, VerificationTokenType } from '../../database/prisma-client';
import { PrismaService } from '../../database/prisma.service';
import { EMAIL_PORT } from '../../integrations/email/email.port';
import type { EmailPort } from '../../integrations/email/email.port';
import { hashPassword } from './credentials';

const VERIFICATION_TOKEN_TTL_HOURS = 24;
const PASSWORD_RESET_TTL_HOURS = 0.5;

/**
 * Account creation and recovery: registration, email verification, password reset.
 *
 * Every query here is a single-table lookup or write, so it stays in the service
 * (rule R4). Sessions live in AuthService. See docs/04.
 */
@Injectable()
export class AuthRegistrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
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

    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        passwordHash: await hashPassword(input.password),
        displayName: input.displayName ?? null,
        status: UserStatus.PENDING_VERIFICATION,
      },
      select: { id: true, email: true },
    });

    const token = await this.issueVerificationToken(
      user.id,
      VerificationTokenType.EMAIL_VERIFICATION,
      VERIFICATION_TOKEN_TTL_HOURS,
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
    const record = await this.findUsableToken(token, VerificationTokenType.EMAIL_VERIFICATION);

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
      PASSWORD_RESET_TTL_HOURS,
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
    const record = await this.findUsableToken(token, VerificationTokenType.PASSWORD_RESET);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash: await hashPassword(password) },
      }),
      this.prisma.verificationToken.update({
        where: { id: record.id },
        data: { consumedAt: new Date() },
      }),
      // A reset invalidates every existing session.
      this.prisma.userSession.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  private async findUsableToken(token: string, type: VerificationTokenType) {
    const record = await this.prisma.verificationToken.findUnique({
      where: { tokenHash: hashOpaqueToken(token) },
    });

    const isUsable =
      record !== null &&
      record.type === type &&
      record.consumedAt === null &&
      record.expiresAt > new Date();

    if (!record || !isUsable) {
      throw AppException.badRequest(
        'invalid_token',
        'This link is invalid or has expired.',
      );
    }

    return record;
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
}
