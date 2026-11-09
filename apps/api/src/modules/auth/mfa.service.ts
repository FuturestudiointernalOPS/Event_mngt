import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { MfaSetup, MfaStatus } from '@event-platform/shared';
import { AppException } from '../../common/app-exception';
import { decryptSecret, deriveKey, encryptSecret } from '../../common/utils/secret-box';
import { newTotpSecret, otpauthUrl, verifyTotp } from '../../common/utils/totp';
import type { Env } from '../../config/env.validation';
import { PrismaService } from '../../database/prisma.service';
import {
  RECOVERY_CODE_COUNT,
  afterFailure,
  hashRecoveryCode,
  isLocked,
  looksLikeRecoveryCode,
  newRecoveryCode,
} from './mfa.rules';

const ISSUER = 'Event Platform';

/** Optional TOTP second factor with single-use recovery codes and brute-force lockout. */
@Injectable()
export class MfaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async status(userId: string): Promise<MfaStatus> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { mfaEnabledAt: true, mfaRecoveryHashes: true },
    });
    return { enabled: user.mfaEnabledAt !== null, recoveryCodesLeft: user.mfaRecoveryHashes.length };
  }

  /** Starts enrolment. MFA stays off until a code from the app is confirmed. */
  async setup(userId: string): Promise<MfaSetup> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true, mfaEnabledAt: true },
    });
    if (user.mfaEnabledAt) {
      throw AppException.conflict('mfa_already_enabled', 'Two-factor authentication is already on.');
    }
    const secret = newTotpSecret();
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecretEnc: encryptSecret(secret, this.key()), mfaLastStep: null },
    });
    return { secret, otpauthUrl: otpauthUrl(secret, user.email, ISSUER) };
  }

  /** Confirms enrolment and returns the recovery codes, shown exactly once. */
  async enable(userId: string, code: string): Promise<{ recoveryCodes: string[] }> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { mfaSecretEnc: true, mfaEnabledAt: true, mfaLastStep: true },
    });
    if (user.mfaEnabledAt || !user.mfaSecretEnc) {
      throw AppException.badRequest('mfa_not_pending', 'Start the setup first.');
    }
    const step = verifyTotp(decryptSecret(user.mfaSecretEnc, this.key()), code, new Date(), null);
    if (step === null) {
      throw AppException.unprocessable('mfa_invalid', 'That code is not correct.');
    }
    const recoveryCodes = Array.from({ length: RECOVERY_CODE_COUNT }, newRecoveryCode);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        mfaEnabledAt: new Date(),
        mfaLastStep: BigInt(step),
        mfaRecoveryHashes: recoveryCodes.map(hashRecoveryCode),
        mfaFailedAttempts: 0,
        mfaLockedUntil: null,
      },
    });
    return { recoveryCodes };
  }

  async disable(userId: string, code: string): Promise<void> {
    await this.verifySecondFactor(userId, code);
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabledAt: null, mfaSecretEnc: null, mfaLastStep: null, mfaRecoveryHashes: [] },
    });
  }

  /** Called after the password is verified: passes silently when MFA is off. */
  async assertLoginAllowed(userId: string, code: string | undefined): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { mfaEnabledAt: true } });
    if (!user.mfaEnabledAt) {
      return;
    }
    if (!code) {
      throw AppException.unauthorized('mfa_required', 'Enter the code from your authenticator app.');
    }
    await this.verifySecondFactor(userId, code);
  }

  private async verifySecondFactor(userId: string, code: string): Promise<void> {
    const now = new Date();
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { mfaSecretEnc: true, mfaEnabledAt: true, mfaLastStep: true, mfaRecoveryHashes: true, mfaFailedAttempts: true, mfaLockedUntil: true },
    });

    if (!user.mfaEnabledAt || !user.mfaSecretEnc) {
      throw AppException.badRequest('mfa_not_enabled', 'Two-factor authentication is not on.');
    }
    if (isLocked(user.mfaLockedUntil, now)) {
      throw AppException.unauthorized('mfa_locked', 'Too many wrong codes. Try again in a few minutes.');
    }

    if (looksLikeRecoveryCode(code)) {
      const hash = hashRecoveryCode(code);
      if (user.mfaRecoveryHashes.includes(hash)) {
        await this.prisma.user.update({
          where: { id: userId },
          data: { mfaRecoveryHashes: user.mfaRecoveryHashes.filter((h) => h !== hash), mfaFailedAttempts: 0 },
        });
        return;
      }
    } else {
      const step = verifyTotp(
        decryptSecret(user.mfaSecretEnc, this.key()),
        code,
        now,
        user.mfaLastStep === null ? null : Number(user.mfaLastStep),
      );
      if (step !== null) {
        await this.prisma.user.update({
          where: { id: userId },
          data: { mfaLastStep: BigInt(step), mfaFailedAttempts: 0, mfaLockedUntil: null },
        });
        return;
      }
    }

    const failure = afterFailure(user.mfaFailedAttempts, now);
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaFailedAttempts: failure.failedAttempts, mfaLockedUntil: failure.lockedUntil },
    });
    throw AppException.unauthorized('mfa_invalid', 'That code is not correct.');
  }

  private key(): Buffer {
    return deriveKey(this.config.get('JWT_ACCESS_SECRET', { infer: true }), 'mfa-encryption');
  }
}
