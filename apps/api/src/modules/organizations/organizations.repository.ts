import { Injectable } from '@nestjs/common';
import { DEFAULT_BRANDING, type Locale } from '@event-platform/shared';
import { PrismaService } from '../../database/prisma.service';
import type { TenantPrismaClient } from '../../database/tenant-transaction.service';
import type { MemberStatus, Organization, UserStatus } from '../../database/prisma-client';
import type { ProvisionRolePlan } from './organizations.rules';

export interface AccountRow {
  id: string;
  email: string;
  status: UserStatus;
  emailVerifiedAt: Date | null;
}

export interface CreateOrganizationData {
  id: string;
  slug: string;
  name: string;
  timeZone: string;
  defaultLocale: Locale;
}

export interface CreatedRole {
  id: string;
  key: string;
  name: string;
}

export interface CreatedMembership {
  id: string;
  roleId: string;
  status: MemberStatus;
}

/**
 * Writes for provisioning a new organisation.
 *
 * The service has already generated the organisation id and opened that organisation's
 * transaction, so every insert satisfies the tenant policy without a special bypass.
 * Identity reads (the account) are not tenant-owned and use the shared client.
 */
@Injectable()
export class OrganizationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAccount(userId: string): Promise<AccountRow | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, status: true, emailVerifiedAt: true },
    });
  }

  findAccountByEmail(email: string): Promise<AccountRow | null> {
    return this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, status: true, emailVerifiedAt: true },
    });
  }

  slugExists(tx: TenantPrismaClient, slug: string): Promise<{ id: string } | null> {
    return tx.organization.findFirst({
      where: { slug },
      select: { id: true },
    });
  }

  findPermissionsByKeys(
    tx: TenantPrismaClient,
    keys: readonly string[],
  ): Promise<Array<{ id: string; key: string }>> {
    return tx.permission.findMany({
      where: { key: { in: [...keys] } },
      select: { id: true, key: true },
    });
  }

  createOrganization(
    tx: TenantPrismaClient,
    data: CreateOrganizationData,
  ): Promise<Organization> {
    return tx.organization.create({
      data: {
        id: data.id,
        slug: data.slug,
        name: data.name,
        status: 'ACTIVE',
      },
    });
  }

  async createWorkspaceDefaults(
    tx: TenantPrismaClient,
    organizationId: string,
    defaults: { timeZone: string; defaultLocale: Locale },
  ): Promise<void> {
    await tx.workspaceSettings.create({
      data: {
        organizationId,
        timeZone: defaults.timeZone,
        defaultLocale: defaults.defaultLocale,
      },
    });
    await tx.workspaceBranding.create({
      data: { organizationId, ...DEFAULT_BRANDING },
    });
  }

  async createEntitlements(
    tx: TenantPrismaClient,
    organizationId: string,
    capabilityKeys: readonly string[],
    assignedByUserId: string,
  ): Promise<void> {
    await tx.organizationCapability.createMany({
      data: capabilityKeys.map((capabilityKey) => ({
        organizationId,
        capabilityKey,
        assignedByUserId,
      })),
      skipDuplicates: true,
    });
  }

  async createSystemRoles(
    tx: TenantPrismaClient,
    organizationId: string,
    plans: readonly ProvisionRolePlan[],
    permissionIdByKey: ReadonlyMap<string, string>,
  ): Promise<Map<string, CreatedRole>> {
    const roles = new Map<string, CreatedRole>();

    for (const plan of plans) {
      const role = await tx.organizationRole.create({
        data: {
          organizationId,
          key: plan.key,
          name: plan.name,
          description: plan.description,
          isSystem: true,
        },
        select: { id: true, key: true, name: true },
      });

      const permissionIds = plan.permissions
        .map((key) => permissionIdByKey.get(key))
        .filter((id): id is string => id !== undefined);

      if (permissionIds.length > 0) {
        await tx.rolePermission.createMany({
          data: permissionIds.map((permissionId) => ({
            roleId: role.id,
            permissionId,
          })),
          skipDuplicates: true,
        });
      }

      roles.set(role.key, role);
    }

    return roles;
  }

  createMembership(
    tx: TenantPrismaClient,
    data: { organizationId: string; userId: string; roleId: string },
  ): Promise<CreatedMembership> {
    return tx.organizationMember.create({
      data: {
        ...data,
        status: 'ACTIVE',
        joinedAt: new Date(),
      },
      select: { id: true, roleId: true, status: true },
    });
  }
}
