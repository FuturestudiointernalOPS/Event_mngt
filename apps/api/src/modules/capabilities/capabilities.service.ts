import { Injectable } from '@nestjs/common';
import {
  CAPABILITY_KEYS,
  capabilitiesForPermissions,
  resolveEffectiveCapabilities,
  type CapabilityCatalogueResponse,
  type MemberCapabilitiesView,
  type OrganizationCapabilitiesView,
} from '@event-platform/shared';
import { AppException } from '../../common/app-exception';
import { AUDIT_ACTIONS } from '../../common/audit/audit.actions';
import { AuditService } from '../../common/audit/audit.service';
import { TenantContextService } from '../../database/tenant-context.service';
import { TenantTransactionService } from '../../database/tenant-transaction.service';
import { CapabilitiesRepository } from './capabilities.repository';
import {
  toCapabilityCatalogue,
  toMemberCapabilitiesView,
  toOrganizationCapabilitiesView,
} from './capabilities.mapper';
import {
  assertAdministratorRemains,
  assertEntitledByOrganization,
  assertMembershipAssignable,
  expandAssignment,
  isAdministrativeCapabilities,
} from './capabilities.rules';

/**
 * The central authorization and capability-management service.
 *
 * Route enforcement happens in CapabilityGuard; services that need a check outside a
 * route call `requireCapability`. Management operations are audited, organisation
 * scoped, and default to refusing anything they cannot prove.
 */
@Injectable()
export class CapabilitiesService {
  constructor(
    private readonly tenantTransaction: TenantTransactionService,
    private readonly tenantContext: TenantContextService,
    private readonly repository: CapabilitiesRepository,
    private readonly audit: AuditService,
  ) {}

  getCatalogue(): CapabilityCatalogueResponse {
    return toCapabilityCatalogue();
  }

  /** True only when the capability is effective for the current request. Default deny. */
  hasCapability(capabilityKey: string): boolean {
    return this.tenantContext.get()?.capabilities?.includes(capabilityKey) === true;
  }

  requireCapability(capabilityKey: string): void {
    if (!this.hasCapability(capabilityKey)) {
      throw AppException.forbidden(
        'capability_denied',
        'You do not have permission to perform this action.',
        { capabilities: [capabilityKey] },
      );
    }
  }

  // Tenant administration --------------------------------------------------

  /** The caller's own effective capabilities; no capability is required to read it. */
  getSelfCapabilities(): Promise<MemberCapabilitiesView> {
    const tenant = this.tenantContext.getOrThrow();
    return this.getMemberCapabilities(tenant.membershipId);
  }

  getWorkspaceOrganizationCapabilities(): Promise<OrganizationCapabilitiesView> {
    const tenant = this.tenantContext.getOrThrow();

    return this.tenantTransaction.withTenant(async (tx, context) => {
      const organization = await this.repository.findOrganization(tx, context.organizationId);
      if (!organization) {
        throw AppException.notFound('tenant_not_found', 'Workspace not found.');
      }

      const granted = await this.repository.listOrganizationCapabilityKeys(
        tx,
        context.organizationId,
      );
      return toOrganizationCapabilitiesView(organization, granted);
    });
  }

  async getMemberCapabilities(memberId: string): Promise<MemberCapabilitiesView> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const member = await this.repository.findMember(tx, tenant.organizationId, memberId);
      if (!member) {
        throw AppException.notFound('not_found', 'Member not found.');
      }

      const organizationCapabilities = await this.repository.listOrganizationCapabilityKeys(
        tx,
        tenant.organizationId,
      );
      return toMemberCapabilitiesView(member, organizationCapabilities);
    });
  }

  async assignMemberCapability(
    memberId: string,
    capabilityKey: string,
  ): Promise<MemberCapabilitiesView> {
    assertMembershipAssignable(capabilityKey);
    const granted = expandAssignment(capabilityKey);
    granted.forEach(assertMembershipAssignable);
    const tenant = this.tenantContext.getOrThrow();

    await this.tenantTransaction.withTenant(async (tx) => {
      const member = await this.repository.findMember(tx, tenant.organizationId, memberId);
      if (!member) {
        throw AppException.notFound('not_found', 'Member not found.');
      }

      const organizationCapabilities = await this.repository.listOrganizationCapabilityKeys(
        tx,
        tenant.organizationId,
      );
      assertEntitledByOrganization(granted, organizationCapabilities);

      await this.repository.addMemberCapabilities(
        tx,
        tenant.organizationId,
        memberId,
        granted,
        tenant.userId,
      );
    });

    await this.audit.record({
      action: AUDIT_ACTIONS.memberCapabilityAssigned,
      targetType: 'member',
      targetId: memberId,
      metadata: { capability: capabilityKey, granted },
    });

    return this.getMemberCapabilities(memberId);
  }

  async revokeMemberCapability(
    memberId: string,
    capabilityKey: string,
  ): Promise<MemberCapabilitiesView> {
    assertMembershipAssignable(capabilityKey);
    const tenant = this.tenantContext.getOrThrow();

    const removed = await this.tenantTransaction.withTenant(async (tx) => {
      const member = await this.repository.findMember(tx, tenant.organizationId, memberId);
      if (!member) {
        throw AppException.notFound('not_found', 'Member not found.');
      }

      const organizationCapabilities = await this.repository.listOrganizationCapabilityKeys(
        tx,
        tenant.organizationId,
      );
      const direct = member.capabilities.map((entry) => entry.capabilityKey);
      const role = capabilitiesForPermissions(
        member.role.permissions.map((entry) => entry.permission.key),
      );
      const effective = resolveEffectiveCapabilities({
        organization: organizationCapabilities,
        role,
        direct,
      });

      // Revoking the last administrative grant would leave the workspace unmanageable.
      if (
        capabilityKey === CAPABILITY_KEYS.organizationManagePermissions &&
        isAdministrativeCapabilities(effective)
      ) {
        const remaining = await this.repository.countOtherAdministrators(
          tx,
          tenant.organizationId,
          memberId,
        );
        assertAdministratorRemains(remaining);
      }

      return this.repository.removeMemberCapability(
        tx,
        tenant.organizationId,
        memberId,
        capabilityKey,
      );
    });

    if (removed > 0) {
      await this.audit.record({
        action: AUDIT_ACTIONS.memberCapabilityRevoked,
        targetType: 'member',
        targetId: memberId,
        metadata: { capability: capabilityKey },
      });
    }

    return this.getMemberCapabilities(memberId);
  }
}
