import { hashOpaqueToken } from '../../common/utils/tokens';
import { composeAccessToken, newAccessSecret } from '../../common/utils/badge';
import type { TenantPrismaClient } from '../../database/tenant-transaction.service';

/**
 * Issues a fresh participant-portal credential for a registration, replacing any earlier
 * one. Only the hash is stored, so the raw token can be shown or e-mailed exactly once.
 */
export async function rotateAccessToken(
  tx: TenantPrismaClient,
  organizationId: string,
  registrationId: string,
): Promise<string> {
  const secret = newAccessSecret();

  await tx.registration.updateMany({
    where: { id: registrationId, organizationId },
    data: { accessTokenHash: hashOpaqueToken(secret) },
  });

  return composeAccessToken(organizationId, registrationId, secret);
}
