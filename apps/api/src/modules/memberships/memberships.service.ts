import { Injectable } from '@nestjs/common';
import type {
  MemberSummary,
  RoleSummary,
  UpdateMemberRoleRequest,
} from '@event-platform/shared';
import { AppException } from '../../common/app-exception';
import { AUDIT_ACTIONS } from '../../common/audit/audit.actions';
import { AuditService } from '../../common/audit/audit.service';
import { TenantTransactionService } from '../../database/tenant-transaction.service';
import { permissionKeys, toMemberSummary, toRoleSummary } from './memberships.mapper';
import { MembershipsRepository } from './memberships.repository';
import { assertAdministratorRemains, isAdministrativeRole } from './memberships.rules';

/**
 * Who belongs to the workspace and what they may do.
 *
 * A role id always has to belong to the same organisation — otherwise an administrator
 * could grant a role from another tenant. Changes take effect immediately because the
 * guard resolves membership on every request.
 */
@Injectable()
export class MembershipsService {
  constructor(
    private readonly tenantTransaction: TenantTransactionService,
    private readonly repository: MembershipsRepository,
    private readonly audit: AuditService,
  ) {}

  async listMembers(): Promise<MemberSummary[]> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const rows = await this.repository.listMembers(tx, tenant.organizationId);
      return rows.map(toMemberSummary);
    });
  }

  async listRoles(): Promise<RoleSummary[]> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const rows = await this.repository.listRoles(tx, tenant.organizationId);
      return rows.map(toRoleSummary);
    });
  }

  async updateRole(memberId: string, input: UpdateMemberRoleRequest): Promise<MemberSummary> {
    const updated = await this.tenantTransaction.withTenant(async (tx, tenant) => {
      const member = await this.repository.findMember(tx, tenant.organizationId, memberId);

      if (!member) {
        throw AppException.notFound('not_found', 'Member not found.');
      }

      const role = await this.repository.findRole(tx, tenant.organizationId, input.roleId);

      if (!role) {
        throw AppException.badRequest(
          'invalid_reference',
          'That role does not exist in this workspace.',
        );
      }

      if (isAdministrativeRole(permissionKeys(member)) && !isAdministrativeRole(toRoleSummary(role).permissions)) {
        const remaining = await this.repository.countOtherAdministrators(
          tx,
          tenant.organizationId,
          memberId,
        );
        assertAdministratorRemains(remaining);
      }

      await this.repository.updateRole(tx, memberId, role.id);
      return toMemberSummary({ ...member, role });
    });

    await this.audit.record({
      action: AUDIT_ACTIONS.memberRoleChanged,
      targetType: 'member',
      targetId: memberId,
      metadata: { role: updated.roleKey },
    });

    return updated;
  }

  async remove(memberId: string): Promise<void> {
    await this.tenantTransaction.withTenant(async (tx, tenant) => {
      const member = await this.repository.findMember(tx, tenant.organizationId, memberId);

      if (!member) {
        throw AppException.notFound('not_found', 'Member not found.');
      }

      if (isAdministrativeRole(permissionKeys(member))) {
        const remaining = await this.repository.countOtherAdministrators(
          tx,
          tenant.organizationId,
          memberId,
        );
        assertAdministratorRemains(remaining);
      }

      await this.repository.removeMember(tx, memberId);
    });

    await this.audit.record({
      action: AUDIT_ACTIONS.memberRemoved,
      targetType: 'member',
      targetId: memberId,
    });
  }
}
