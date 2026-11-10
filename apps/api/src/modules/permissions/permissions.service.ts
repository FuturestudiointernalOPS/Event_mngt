import { Injectable } from '@nestjs/common';
import { AppException } from '../../common/app-exception';
import type { TenantAccess } from '../../common/types/authenticated-user';
import { MemberStatus, OrganizationStatus } from '../../database/prisma-client';
import { TenantTransactionService } from '../../database/tenant-transaction.service';
import type { TenantPrismaClient } from '../../database/tenant-transaction.service';
import { toTenantAccess } from './permissions.mapper';

/**
 * Tenant resolution and capability evaluation.
 *
 * `resolveTenantAccess*` is the only place where a workspace identifier from the
 * request becomes an organisation id. The member's role permissions, direct capability
 * grants and organisation entitlements are read on every request, so role changes,
 * direct grants and entitlement revocation apply immediately.
 *
 * Resolution runs in the user-scoped bootstrap transaction: it must work before tenant
 * context exists, and row-level security only exposes this caller's own memberships,
 * direct grants and organisation entitlements there. See WP-01 and docs/03.
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
        capabilities: { select: { capabilityKey: true } },
        role: {
          select: {
            key: true,
            permissions: { select: { permission: { select: { key: true } } } },
          },
        },
        organization: {
          select: { capabilities: { select: { capabilityKey: true } } },
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
