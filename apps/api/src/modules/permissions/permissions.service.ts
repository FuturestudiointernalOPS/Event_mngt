import { Injectable } from '@nestjs/common';
import { MemberStatus, OrganizationStatus } from '../../database/prisma-client';
import { ALL_PERMISSIONS } from '@event-platform/shared';
import { AppException } from '../../common/app-exception';
import type { TenantAccess } from '../../common/types/authenticated-user';
import { PrismaService } from '../../database/prisma.service';

/**
 * RBAC evaluation and tenant resolution.
 *
 * `resolveTenantAccess*` is the only place where a workspace identifier from the
 * request becomes an organisation id. Permissions are read from the membership's role
 * on every request, so role changes and removals apply immediately.
 *
 * These queries intentionally run outside TenantTransactionService: they are the step
 * that establishes tenant context. They always constrain by the authenticated user id.
 */
@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveTenantAccessBySlug(userId: string, slug: string): Promise<TenantAccess> {
    const organization = await this.prisma.organization.findUnique({
      where: { slug },
      select: { id: true, status: true },
    });

    if (!organization || organization.status !== OrganizationStatus.ACTIVE) {
      throw AppException.notFound('tenant_not_found', 'Workspace not found.');
    }

    return this.resolveMembership(userId, organization.id);
  }

  async resolveTenantAccessById(
    userId: string,
    organizationId: string,
  ): Promise<TenantAccess> {
    return this.resolveMembership(userId, organizationId);
  }

  /** Permission catalogue, used by the team management screen. */
  listPermissionCatalogue(): string[] {
    return [...ALL_PERMISSIONS];
  }

  private async resolveMembership(
    userId: string,
    organizationId: string,
  ): Promise<TenantAccess> {
    const membership = await this.prisma.organizationMember.findUnique({
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
      throw AppException.forbidden(
        'membership_required',
        'You do not have access to this workspace.',
      );
    }

    return {
      organizationId,
      membershipId: membership.id,
      roleKey: membership.role.key,
      permissions: membership.role.permissions.map((entry) => entry.permission.key),
    };
  }
}
