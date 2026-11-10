import type { UserStatus } from '../../database/prisma-client';

/**
 * Whether an account may start or own an organisation.
 *
 * Shared by self-service onboarding and platform-created organisations so both paths
 * refuse the same accounts for the same reason. It is a pure predicate (R11).
 */

export interface AccountState {
  status: UserStatus;
  emailVerifiedAt: Date | null;
}

export type AccountOnboardingProblem = 'suspended' | 'unverified';

export function accountOnboardingProblem(
  account: AccountState,
): AccountOnboardingProblem | null {
  if (account.status === 'SUSPENDED') {
    return 'suspended';
  }

  if (account.status !== 'ACTIVE' || account.emailVerifiedAt === null) {
    return 'unverified';
  }

  return null;
}
