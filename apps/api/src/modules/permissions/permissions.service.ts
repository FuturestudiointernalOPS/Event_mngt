import { Injectable } from '@nestjs/common';
import { ALL_PERMISSIONS } from '@event-platform/shared';
import { AppException } from '../../common/app-exception';
import type { TenantAccess } from '../../common/types/authenticated-user';
import { MemberStatus, OrganizationStatus } from '../../database/prisma-client';
import { TenantTransactionService } from '../../database/tenant-transaction.service';
import type { TenantPrismaClient } from '../../database/tenant-transaction.service';
import { toTenantAccess } from './permissions.mapper';

/**
 * RBAC evaluation and tenant resolution.
 *
 * `resolveTenantAccess*` is the only place where a workspace identifier from the
 * request becomes an organisation id. Permissions are read from the membership's role
 * on every request, so role changes and removals apply immediately.
 *
 * Resolution runs in the user-scoped bootstrap transaction: it must work before tenant
 * context exists, and row-level security only exposes this caller's own memberships
 * there. See WP-01 and docs/03.
 */
@Injectable()
export class PermissionsService {
  constructor(private readonly tenantTransaction: TenantTransactionService) {}

  async resolveTenantAccessBySlug(userId: string, slug: string): Promise<TenantAccess> {
    return this.tenantTransaction.withUserScope(userId, async (tx) => {
      const organization = await tx.organization.findFirst({
        where: { slug, status: OrganizationStatus.ACTIVE },
        select: { id: true },
      });

      // A workspace the caller cannot see and one that does not exist are answered
      // identically: a tenant route must not reveal another organisation's existence.
      if (!organization) {
        throw membershipRequired();
      }

      return this.loadAccess(tx, userId, organization.id);
    });
  }

  async resolveTenantAccessById(userId: string, organizationId: string): Promise<TenantAccess> {
    return this.tenantTransaction.withUserScope(userId, (tx) =>
      this.loadAccess(tx, userId, organizationId),
    );
  }

  /** Permission catalogue, used by the team management screen. */
  listPermissionCatalogue(): string[] {
    return [...ALL_PERMISSIONS];
  }

  private async loadAccess(
    tx: TenantPrismaClient,
    userId: string,
    organizationId: string,
  ): Promise<TenantAccess> {
    const membership = await tx.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
      select: {
        id: true,
        status: true,
        role: {
          select: {
            key: true,
            permissions: { select: { permission: { select: { key: true } } } },
          },
        },
      },
    });

    if (!membership || membership.status !== MemberStatus.ACTIVE) {
      throw membershipRequired();
    }

    return toTenantAccess(organizationId, membership);
  }
}

function membershipRequired(): AppException {
  return AppException.forbidden(
    'membership_required',
    'You do not have access to this workspace.',
  );
}
