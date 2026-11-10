import { Injectable } from '@nestjs/common';
import type {
  InvitationSummary,
  MemberSummary,
  RoleSummary,
  UpdateMemberRequest,
} from '@event-platform/shared';
import { AppException } from '../../common/app-exception';
import { AUDIT_ACTIONS } from '../../common/audit/audit.actions';
import { AuditService } from '../../common/audit/audit.service';
import { TenantTransactionService } from '../../database/tenant-transaction.service';
import {
  directCapabilityKeys,
  permissionKeys,
  toInvitationSummary,
  toMemberSummary,
  toRoleSummary,
} from './memberships.mapper';
import { MembershipsRepository } from './memberships.repository';
import { assertAdministratorRemains, isAdministrativeCapabilities } from './memberships.rules';

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

  /** Invitations a manager can still revoke. Expired and consumed ones are hidden. */
  async listInvitations(): Promise<InvitationSummary[]> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const rows = await this.repository.listPendingInvitations(tx, tenant.organizationId);
      return rows.map(toInvitationSummary);
    });
  }

  async revokeInvitation(invitationId: string): Promise<void> {
    await this.tenantTransaction.withTenant(async (tx, tenant) => {
      const removed = await this.repository.revokeInvitation(
        tx,
        tenant.organizationId,
        invitationId,
      );

      if (removed === 0) {
        throw AppException.notFound('not_found', 'Invitation not found.');
      }
    });

    await this.audit.record({
      action: AUDIT_ACTIONS.invitationRevoked,
      targetType: 'invitation',
      targetId: invitationId,
    });
  }

  /**
   * Changes a member's role, their status, or both.
   *
   * Two invariants hold whichever field moves: the role must belong to this workspace,
   * and the workspace must keep at least one administrator. Suspension never applies to
   * an invitation that was never accepted.
   */
  async updateMember(
    memberId: string,
    input: UpdateMemberRequest,
  ): Promise<MemberSummary> {
    const outcome = await this.tenantTransaction.withTenant(async (tx, tenant) => {
      const member = await this.repository.findMember(tx, tenant.organizationId, memberId);

      if (!member) {
        throw AppException.notFound('not_found', 'Member not found.');
      }

      const role = input.roleId
        ? await this.repository.findRole(tx, tenant.organizationId, input.roleId)
        : null;

      if (input.roleId && !role) {
        throw AppException.badRequest(
          'invalid_reference',
          'That role does not exist in this workspace.',
        );
      }

      if (input.status && member.status === 'INVITED') {
        throw AppException.unprocessable(
          'invalid_status_transition',
          'An invitation that was never accepted cannot be suspended.',
        );
      }

      const losesAdministration =
        isAdministrativeCapabilities(permissionKeys(member)) &&
        ((role !== null && !isAdministrativeCapabilities(toRoleSummary(role).permissions)) ||
          input.status === 'SUSPENDED');

      if (losesAdministration) {
        const remaining = await this.repository.countOtherAdministrators(
          tx,
          tenant.organizationId,
          memberId,
        );
        assertAdministratorRemains(remaining);
      }

      if (role) {
        await this.repository.updateRole(tx, memberId, role.id);
      }

      if (input.status) {
        await this.repository.updateStatus(tx, memberId, input.status);
      }

      return toMemberSummary({
        ...member,
        role: role ?? member.role,
        status: input.status ?? member.status,
      });
    });

    await this.audit.record({
      action: input.status
        ? AUDIT_ACTIONS.memberStatusChanged
        : AUDIT_ACTIONS.memberRoleChanged,
      targetType: 'member',
      targetId: memberId,
      metadata: {
        ...(input.roleId && { role: outcome.roleKey }),
        ...(input.status && { status: input.status }),
      },
    });

    return outcome;
  }

  async remove(memberId: string): Promise<void> {
    await this.tenantTransaction.withTenant(async (tx, tenant) => {
      const member = await this.repository.findMember(tx, tenant.organizationId, memberId);

      if (!member) {
        throw AppException.notFound('not_found', 'Member not found.');
      }

      if (isAdministrativeCapabilities(permissionKeys(member), directCapabilityKeys(member))) {
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
