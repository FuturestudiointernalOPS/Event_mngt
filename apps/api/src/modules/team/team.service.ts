import { Injectable } from '@nestjs/common';
import {
  RoleSummary,
  TeamMember,
  UpdateMemberRequest,
} from '@event-platform/shared';
import { writeAudit } from '../../common/audit/audit';
import { AppException } from '../../common/app-exception';
import { MemberStatus } from '../../database/prisma-client';
import { TenantTransactionService } from '../../database/tenant-transaction.service';
import { assertAdminRemains } from './team.rules';

const MEMBER_SELECT = {
  id: true,
  userId: true,
  status: true,
  joinedAt: true,
  user: { select: { email: true, displayName: true } },
  role: { select: { key: true, name: true } },
} as const;

type MemberRow = {
  id: string;
  userId: string;
  status: MemberStatus;
  joinedAt: Date | null;
  user: { email: string; displayName: string | null };
  role: { key: string; name: string };
};

function toMember(row: MemberRow): TeamMember {
  return {
    id: row.id,
    userId: row.userId,
    email: row.user.email,
    displayName: row.user.displayName,
    roleKey: row.role.key,
    roleName: row.role.name,
    status: row.status,
    joinedAt: row.joinedAt ? row.joinedAt.toISOString() : null,
  };
}

/** Members and roles of one workspace. Invitations live in InvitationsService. */
@Injectable()
export class TeamService {
  constructor(private readonly tenantTransaction: TenantTransactionService) {}

  listMembers(): Promise<TeamMember[]> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const rows = await tx.organizationMember.findMany({
        where: { organizationId: tenant.organizationId },
        orderBy: { createdAt: 'asc' },
        select: MEMBER_SELECT,
      });
      return rows.map(toMember);
    });
  }

  listRoles(): Promise<RoleSummary[]> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const roles = await tx.organizationRole.findMany({
        where: { organizationId: tenant.organizationId },
        orderBy: { name: 'asc' },
        select: {
          key: true,
          name: true,
          description: true,
          permissions: { select: { permission: { select: { key: true } } } },
        },
      });
      return roles.map((role) => ({
        key: role.key,
        name: role.name,
        description: role.description,
        permissions: role.permissions.map((entry) => entry.permission.key),
      }));
    });
  }

  updateMember(memberId: string, input: UpdateMemberRequest): Promise<TeamMember> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const member = await tx.organizationMember.findFirst({
        where: { id: memberId, organizationId: tenant.organizationId },
        select: MEMBER_SELECT,
      });

      if (!member) {
        throw AppException.notFound('not_found', 'Member not found.');
      }

      const role = input.roleKey
        ? await tx.organizationRole.findFirst({
            where: { organizationId: tenant.organizationId, key: input.roleKey },
            select: { id: true, key: true },
          })
        : null;

      if (input.roleKey && !role) {
        throw AppException.badRequest('invalid_role', 'This role does not exist.');
      }

      const nextRoleKey = role?.key ?? member.role.key;
      const nextStatus = input.status ?? member.status;

      await this.assertAdminStays(tx, tenant.organizationId, member, {
        roleKey: nextRoleKey,
        status: nextStatus,
      });

      const updated = await tx.organizationMember.update({
        where: { id: member.id },
        data: {
          ...(role && { roleId: role.id }),
          ...(input.status && { status: input.status }),
        },
        select: MEMBER_SELECT,
      });

      await this.audit(tx, tenant.organizationId, tenant.membershipId, 'member.updated', member.id);
      return toMember(updated);
    });
  }

  removeMember(memberId: string): Promise<void> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const member = await tx.organizationMember.findFirst({
        where: { id: memberId, organizationId: tenant.organizationId },
        select: MEMBER_SELECT,
      });

      if (!member) {
        throw AppException.notFound('not_found', 'Member not found.');
      }

      await this.assertAdminStays(tx, tenant.organizationId, member, {
        roleKey: member.role.key,
        status: 'SUSPENDED',
      });

      await tx.organizationMember.delete({ where: { id: member.id } });
      await this.audit(tx, tenant.organizationId, tenant.membershipId, 'member.removed', member.id);
    });
  }

  private async assertAdminStays(
    tx: import('../../database/tenant-transaction.service').TenantPrismaClient,
    organizationId: string,
    member: MemberRow,
    next: { roleKey: string; status: string },
  ): Promise<void> {
    const activeAdminCount = await tx.organizationMember.count({
      where: {
        organizationId,
        status: MemberStatus.ACTIVE,
        role: { key: 'organisation_admin' },
      },
    });

    assertAdminRemains({
      targetRoleKey: member.role.key,
      targetStatus: member.status,
      activeAdminCount,
      willStillBeActiveAdmin: next.roleKey === 'organisation_admin' && next.status === 'ACTIVE',
    });
  }

  private async audit(
    tx: import('../../database/tenant-transaction.service').TenantPrismaClient,
    organizationId: string,
    membershipId: string,
    action: string,
    targetId: string,
  ): Promise<void> {
    await writeAudit(tx, {
      organizationId,
      action,
      targetType: 'team',
      targetId,
      metadata: { membershipId },
    });
  }
}
