import { Injectable } from '@nestjs/common';
import { CAPABILITY_KEYS, PERMISSIONS } from '@event-platform/shared';
import { PrismaService } from '../../database/prisma.service';
import type { TenantPrismaClient } from '../../database/tenant-transaction.service';
import type { MemberRow, MemberWithPermissions, RoleRow } from './memberships.mapper';

const MEMBER_SELECT = {
  id: true,
  status: true,
  joinedAt: true,
  user: { select: { id: true, email: true, displayName: true } },
  role: { select: { id: true, key: true, name: true } },
} as const;

const ROLE_SELECT = {
  id: true,
  key: true,
  name: true,
  isSystem: true,
  permissions: { select: { permission: { select: { key: true } } } },
} as const;

const MEMBER_WITH_PERMISSIONS_SELECT = {
  ...MEMBER_SELECT,
  capabilities: { select: { capabilityKey: true } },
  role: {
    select: {
      id: true,
      key: true,
      name: true,
      permissions: { select: { permission: { select: { key: true } } } },
    },
  },
} as const;

/**
 * Team reads and writes. Member listings join users and roles, and the administrator
 * count is an aggregate, so this belongs in a repository rather than the service.
 */
@Injectable()
export class MembershipsRepository {
  constructor(private readonly prisma: PrismaService) {}

  listMembers(tx: TenantPrismaClient, organizationId: string): Promise<MemberRow[]> {
    return tx.organizationMember.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'asc' },
      select: MEMBER_SELECT,
    });
  }

  listRoles(tx: TenantPrismaClient, organizationId: string): Promise<RoleRow[]> {
    return tx.organizationRole.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
      select: ROLE_SELECT,
    });
  }

  findMember(
    tx: TenantPrismaClient,
    organizationId: string,
    memberId: string,
  ): Promise<MemberWithPermissions | null> {
    return tx.organizationMember.findFirst({
      where: { id: memberId, organizationId },
      select: MEMBER_WITH_PERMISSIONS_SELECT,
    });
  }

  findRole(
    tx: TenantPrismaClient,
    organizationId: string,
    roleId: string,
  ): Promise<RoleRow | null> {
    return tx.organizationRole.findFirst({
      where: { id: roleId, organizationId },
      select: ROLE_SELECT,
    });
  }

  findMembershipForUser(
    tx: TenantPrismaClient,
    organizationId: string,
    userId: string,
  ): Promise<{ id: string } | null> {
    return tx.organizationMember.findFirst({
      where: { organizationId, userId },
      select: { id: true },
    });
  }

  countOtherAdministrators(
    tx: TenantPrismaClient,
    organizationId: string,
    excludeMemberId: string,
  ): Promise<number> {
    return tx.organizationMember.count({
      where: {
        organizationId,
        status: 'ACTIVE',
        id: { not: excludeMemberId },
        OR: [
          {
            role: {
              permissions: { some: { permission: { key: PERMISSIONS.memberManage } } },
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

  findUserByEmail(email: string): Promise<{ id: string } | null> {
    // Identity table: never tenant-owned, always queried by a derived identifier.
    return this.prisma.user.findUnique({ where: { email }, select: { id: true } });
  }

  async updateRole(tx: TenantPrismaClient, memberId: string, roleId: string): Promise<void> {
    await tx.organizationMember.update({ where: { id: memberId }, data: { roleId } });
  }

  async removeMember(tx: TenantPrismaClient, memberId: string): Promise<void> {
    await tx.organizationMember.delete({ where: { id: memberId } });
  }

  findPendingInvitation(
    tx: TenantPrismaClient,
    organizationId: string,
    email: string,
  ): Promise<{ id: string } | null> {
    return tx.invitation.findFirst({
      where: { organizationId, email, consumedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true },
    });
  }

  /** Invitations still usable, newest first. Consumed and expired rows are excluded. */
  listPendingInvitations(
    tx: TenantPrismaClient,
    organizationId: string,
  ): Promise<Array<{ id: string; email: string; expiresAt: Date; role: { key: string } }>> {
    return tx.invitation.findMany({
      where: { organizationId, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, email: true, expiresAt: true, role: { select: { key: true } } },
    });
  }

  /** Returns 0 when the invitation is gone, already used or belongs to another tenant. */
  async revokeInvitation(
    tx: TenantPrismaClient,
    organizationId: string,
    invitationId: string,
  ): Promise<number> {
    const result = await tx.invitation.deleteMany({
      where: { id: invitationId, organizationId, consumedAt: null },
    });

    return result.count;
  }

  createInvitation(
    tx: TenantPrismaClient,
    data: {
      organizationId: string;
      email: string;
      roleId: string;
      tokenHash: string;
      invitedByUserId: string;
      expiresAt: Date;
    },
  ): Promise<{ id: string; email: string; expiresAt: Date; role: { key: string } }> {
    return tx.invitation.create({
      data,
      select: { id: true, email: true, expiresAt: true, role: { select: { key: true } } },
    });
  }

  /** Runs in the user scope: policy lets an invited person read their own invitation. */
  findInvitationByToken(
    tx: TenantPrismaClient,
    tokenHash: string,
  ): Promise<{
    id: string;
    organizationId: string;
    roleId: string;
    email: string;
    consumedAt: Date | null;
    expiresAt: Date;
  } | null> {
    return tx.invitation.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        organizationId: true,
        roleId: true,
        email: true,
        consumedAt: true,
        expiresAt: true,
      },
    });
  }

  /** Returns 0 when another request already consumed the invitation. */
  async consumeInvitation(tx: TenantPrismaClient, invitationId: string): Promise<number> {
    const result = await tx.invitation.updateMany({
      where: { id: invitationId, consumedAt: null },
      data: { consumedAt: new Date() },
    });

    return result.count;
  }

  async createMembership(
    tx: TenantPrismaClient,
    data: { organizationId: string; userId: string; roleId: string },
  ): Promise<void> {
    await tx.organizationMember.create({
      data: { ...data, status: 'ACTIVE', joinedAt: new Date() },
    });
  }
}
