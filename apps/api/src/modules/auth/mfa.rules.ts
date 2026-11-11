import { createHash, randomBytes } from 'node:crypto';
import { base32Encode } from '../../common/utils/totp';

/** MFA policy as pure functions (R11). */
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 5;
export const RECOVERY_CODE_COUNT = 8;

export function isLocked(lockedUntil: Date | null, now: Date): boolean {
  return lockedUntil !== null && lockedUntil > now;
}

/** After a failure: the new counter and, when the limit is reached, the lock expiry. */
export function afterFailure(
  failedAttempts: number,
  now: Date,
): { failedAttempts: number; lockedUntil: Date | null } {
  const next = failedAttempts + 1;
  return next >= MAX_FAILED_ATTEMPTS
    ? { failedAttempts: 0, lockedUntil: new Date(now.getTime() + LOCKOUT_MINUTES * 60_000) }
    : { failedAttempts: next, lockedUntil: null };
}

/** Recovery codes look like ABCDE-FGHIJ and are compared case- and dash-insensitively. */
export function newRecoveryCode(): string {
  const raw = base32Encode(randomBytes(7)).slice(0, 10);
  return `${raw.slice(0, 5)}-${raw.slice(5)}`;
}

export function normaliseRecoveryCode(input: string): string {
  return input.replace(/[\s-]/g, '').toUpperCase();
}

export function hashRecoveryCode(code: string): string {
  return createHash('sha256').update(normaliseRecoveryCode(code)).digest('hex');
}

export function looksLikeRecoveryCode(input: string): boolean {
  return /^[A-Za-z2-7]{5}-?[A-Za-z2-7]{5}$/.test(input.trim());
}
