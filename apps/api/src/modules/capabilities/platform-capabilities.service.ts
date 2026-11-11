import { Injectable } from '@nestjs/common';
import type {
  OrganizationCapabilitiesView,
  PlatformOrganizationSummary,
} from '@event-platform/shared';
import { AppException } from '../../common/app-exception';
import { AUDIT_ACTIONS } from '../../common/audit/audit.actions';
import { AuditService } from '../../common/audit/audit.service';
import { TenantTransactionService } from '../../database/tenant-transaction.service';
import { CapabilitiesRepository } from './capabilities.repository';
import {
  toOrganizationCapabilitiesView,
  toPlatformOrganizationSummary,
} from './capabilities.mapper';
import { assertOrganizationAssignable, expandAssignment } from './capabilities.rules';

/**
 * Cross-tenant platform administration.
 *
 * Every route that reaches this service is behind a platform-scoped capability, which
 * the guard checks against the verified administrator claim. Reads use the narrow
 * platform database scope; writes are scoped to the named organisation.
 */
@Injectable()
export class PlatformCapabilitiesService {
  constructor(
    private readonly tenantTransaction: TenantTransactionService,
    private readonly repository: CapabilitiesRepository,
    private readonly audit: AuditService,
  ) {}

  async listOrganizations(actorUserId: string): Promise<PlatformOrganizationSummary[]> {
    const rows = await this.tenantTransaction.withPlatformAdmin(actorUserId, (tx) =>
      this.repository.listOrganizations(tx),
    );

    return rows.map(toPlatformOrganizationSummary);
  }

  async getOrganizationCapabilities(
    organizationId: string,
    actorUserId: string,
  ): Promise<OrganizationCapabilitiesView> {
    return this.tenantTransaction.withOrganizationScope(organizationId, async (tx) => {
      const organization = await this.repository.findOrganization(tx, organizationId);

      if (!organization) {
        throw AppException.notFound('tenant_not_found', 'Workspace not found.');
      }

      const granted = await this.repository.listOrganizationCapabilityKeys(tx, organizationId);
      return toOrganizationCapabilitiesView(organization, granted);
    });
  }

  async assignOrganizationCapability(
    organizationId: string,
    capabilityKey: string,
    actorUserId: string,
  ): Promise<OrganizationCapabilitiesView> {
    assertOrganizationAssignable(capabilityKey);
    const granted = expandAssignment(capabilityKey);
    granted.forEach(assertOrganizationAssignable);

    await this.tenantTransaction.withOrganizationScope(organizationId, async (tx) => {
      const organization = await this.repository.findOrganization(tx, organizationId);
      if (!organization) {
        throw AppException.notFound('tenant_not_found', 'Workspace not found.');
      }

      await this.repository.addOrganizationCapabilities(
        tx,
        organizationId,
        granted,
        actorUserId,
      );
    });

    await this.audit.record({
      action: AUDIT_ACTIONS.organizationCapabilityAssigned,
      organizationId,
      actorUserId,
      targetType: 'organization',
      targetId: organizationId,
      metadata: { capability: capabilityKey, granted },
    });

    return this.getOrganizationCapabilities(organizationId, actorUserId);
  }

  async revokeOrganizationCapability(
    organizationId: string,
    capabilityKey: string,
    actorUserId: string,
  ): Promise<OrganizationCapabilitiesView> {
    assertOrganizationAssignable(capabilityKey);

    const removed = await this.tenantTransaction.withOrganizationScope(
      organizationId,
      (tx) => this.repository.removeOrganizationCapability(tx, organizationId, capabilityKey),
    );

    if (removed > 0) {
      await this.audit.record({
        action: AUDIT_ACTIONS.organizationCapabilityRevoked,
        organizationId,
        actorUserId,
        targetType: 'organization',
        targetId: organizationId,
        metadata: { capability: capabilityKey },
      });
    }

    return this.getOrganizationCapabilities(organizationId, actorUserId);
  }
}
