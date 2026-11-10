import { Injectable } from '@nestjs/common';
import { CAPABILITY_KEYS } from '@event-platform/shared';
import type { TenantPrismaClient } from '../../database/tenant-transaction.service';

const MEMBER_SELECT = {
  id: true,
  userId: true,
  status: true,
  user: { select: { email: true, displayName: true } },
  role: {
    select: {
      id: true,
      key: true,
      name: true,
      permissions: { select: { permission: { select: { key: true } } } },
    },
  },
  capabilities: { select: { capabilityKey: true } },
} as const;

/**
 * Capability persistence. Every method receives the transaction-scoped client; the
 * service owns the transaction boundary and the organisation predicate always comes
 * from a verified membership or an explicitly authorised platform administrator.
 */
@Injectable()
export class CapabilitiesRepository {
  findOrganization(
    tx: TenantPrismaClient,
    organizationId: string,
  ): Promise<{ id: string; slug: string; name: string; status: string } | null> {
    return tx.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, slug: true, name: true, status: true },
    });
  }

  listOrganizations(tx: TenantPrismaClient) {
    return tx.organization.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        slug: true,
        name: true,
        status: true,
        _count: { select: { capabilities: true } },
      },
    });
  }

  async listOrganizationCapabilityKeys(
    tx: TenantPrismaClient,
    organizationId: string,
  ): Promise<string[]> {
    const rows = await tx.organizationCapability.findMany({
      where: { organizationId },
      select: { capabilityKey: true },
      orderBy: { capabilityKey: 'asc' },
    });
    return rows.map((row) => row.capabilityKey);
  }

  async listMemberCapabilityKeys(
    tx: TenantPrismaClient,
    organizationId: string,
    memberId: string,
  ): Promise<string[]> {
    const rows = await tx.memberCapability.findMany({
      where: { organizationId, memberId },
      select: { capabilityKey: true },
      orderBy: { capabilityKey: 'asc' },
    });
    return rows.map((row) => row.capabilityKey);
  }

  findMember(tx: TenantPrismaClient, organizationId: string, memberId: string) {
    return tx.organizationMember.findFirst({
      where: { id: memberId, organizationId },
      select: MEMBER_SELECT,
    });
  }

  async addOrganizationCapabilities(
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

  async removeOrganizationCapability(
    tx: TenantPrismaClient,
    organizationId: string,
    capabilityKey: string,
  ): Promise<number> {
    const result = await tx.organizationCapability.deleteMany({
      where: { organizationId, capabilityKey },
    });
    return result.count;
  }

  async addMemberCapabilities(
    tx: TenantPrismaClient,
    organizationId: string,
    memberId: string,
    capabilityKeys: readonly string[],
    assignedByUserId: string,
  ): Promise<void> {
    await tx.memberCapability.createMany({
      data: capabilityKeys.map((capabilityKey) => ({
        organizationId,
        memberId,
        capabilityKey,
        assignedByUserId,
      })),
      skipDuplicates: true,
    });
  }

  async removeMemberCapability(
    tx: TenantPrismaClient,
    organizationId: string,
    memberId: string,
    capabilityKey: string,
  ): Promise<number> {
    const result = await tx.memberCapability.deleteMany({
      where: { organizationId, memberId, capabilityKey },
    });
    return result.count;
  }

  /**
   * Counts members who can still administer permissions, whether through their role or
   * through a direct grant. Used to refuse removing the last administrator.
   */
  countOtherAdministrators(
    tx: TenantPrismaClient,
    organizationId: string,
    excludeMemberId?: string,
  ): Promise<number> {
    return tx.organizationMember.count({
      where: {
        organizationId,
        status: 'ACTIVE',
        ...(excludeMemberId ? { id: { not: excludeMemberId } } : {}),
        OR: [
          {
            role: {
              permissions: { some: { permission: { key: 'member:manage' } } },
            },
          },
          {
            capabilities: {
              some: { capabilityKey: CAPABILITY_KEYS.organizationManagePermissions },
            },
          },
        ],
      },
    });
  }
}
