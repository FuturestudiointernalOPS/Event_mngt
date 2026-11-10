import {
  capabilitiesForPermissions,
  permissionsForCapabilities,
  resolveEffectiveCapabilities,
} from '@event-platform/shared';
import type { TenantAccess } from '../../common/types/authenticated-user';
import type { MemberStatus } from '../../database/prisma-client';

/** The shape the tenant-resolution query returns. */
export interface MembershipWithRole {
  id: string;
  status: MemberStatus;
  /** Direct capability grants attached to the membership. */
  capabilities: Array<{ capabilityKey: string }>;
  role: {
    key: string;
    permissions: Array<{ permission: { key: string } }>;
  };
  organization: {
    capabilities: Array<{ capabilityKey: string }>;
  };
}

/**
 * Turns the three sources of authority into the request's effective set.
 *
 * Role permissions are translated to capabilities once, at the boundary, so the rest
 * of the application never reasons about `resource:action` strings again.
 */
export function toTenantAccess(
  organizationId: string,
  membership: MembershipWithRole,
): TenantAccess {
  const roleCapabilities = capabilitiesForPermissions(
    membership.role.permissions.map((entry) => entry.permission.key),
  );
  const directCapabilities = membership.capabilities.map((entry) => entry.capabilityKey);
  const organizationCapabilities = membership.organization.capabilities.map(
    (entry) => entry.capabilityKey,
  );
  const capabilities = resolveEffectiveCapabilities({
    organization: organizationCapabilities,
    role: roleCapabilities,
    direct: directCapabilities,
  });

  return {
    organizationId,
    membershipId: membership.id,
    roleKey: membership.role.key,
    capabilities,
    organizationCapabilities,
    roleCapabilities,
    directCapabilities,
    permissions: permissionsForCapabilities(capabilities),
  };
}
