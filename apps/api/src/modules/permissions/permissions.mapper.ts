import type { TenantAccess } from '../../common/types/authenticated-user';
import type { MemberStatus } from '../../database/prisma-client';

/** The shape the tenant-resolution query returns. */
export interface MembershipWithRole {
  id: string;
  status: MemberStatus;
  role: {
    key: string;
    permissions: Array<{ permission: { key: string } }>;
  };
}

export function toTenantAccess(
  organizationId: string,
  membership: MembershipWithRole,
): TenantAccess {
  return {
    organizationId,
    membershipId: membership.id,
    roleKey: membership.role.key,
    permissions: membership.role.permissions.map((entry) => entry.permission.key),
  };
}
