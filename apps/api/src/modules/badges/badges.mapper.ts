import type { Badge, IssuedBadge } from '@event-platform/shared';
import type { BadgeWithReference } from './badges.repository';

/** Row → contract. The token is never part of the base badge shape. */
export function toBadge(row: BadgeWithReference): Badge {
  return {
    id: row.id,
    registrationId: row.registrationId,
    reference: row.registration.reference,
    status: row.status,
    issuedAt: row.issuedAt.toISOString(),
    revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
    reissueCount: row.reissueCount,
  };
}

export function toIssuedBadge(row: BadgeWithReference, token: string): IssuedBadge {
  return { ...toBadge(row), token };
}
