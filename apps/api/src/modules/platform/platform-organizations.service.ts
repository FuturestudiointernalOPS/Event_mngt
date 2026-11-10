import { Injectable } from '@nestjs/common';
import type {
  CreatePlatformOrganizationRequest,
  ListPlatformOrganizationsQuery,
  PlatformOrganizationDetail,
  PlatformOrganizationOverview,
  UpdateOrganizationStatusRequest,
} from '@event-platform/shared';
import { AppException } from '../../common/app-exception';
import { AUDIT_ACTIONS } from '../../common/audit/audit.actions';
import { AuditService } from '../../common/audit/audit.service';
import type { PaginatedResult } from '../../common/types/authenticated-user';
import { accountOnboardingProblem } from '../../common/utils/account-state';
import { TenantTransactionService } from '../../database/tenant-transaction.service';
import { OrganizationProvisioningService } from '../organizations/organization-provisioning.service';
import {
  toPlatformOrganizationDetail,
  toPlatformOrganizationOverview,
} from './platform-organizations.mapper';
import { PlatformOrganizationsRepository } from './platform-organizations.repository';

/**
 * Platform oversight of organisations (WP platform).
 *
 * Listing and detail use the support scope: identity plus aggregate counts only, never
 * a member's or participant's row. Suspension and creation use the narrower platform
 * scope. Every detail read and status change is appended to the target organisation's
 * audit trail.
 */
@Injectable()
export class PlatformOrganizationsService {
  constructor(
    private readonly tenantTransaction: TenantTransactionService,
    private readonly repository: PlatformOrganizationsRepository,
    private readonly provisioning: OrganizationProvisioningService,
    private readonly audit: AuditService,
  ) {}

  async overview(
    query: ListPlatformOrganizationsQuery,
    actorUserId: string,
  ): Promise<PaginatedResult<PlatformOrganizationOverview>> {
    const [rows, total] = await this.tenantTransaction.withPlatformSupport(
      actorUserId,
      (tx) => this.repository.listOverview(tx, query),
    );

    return {
      items: rows.map(toPlatformOrganizationOverview),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  async detail(
    organizationId: string,
    actorUserId: string,
  ): Promise<PlatformOrganizationDetail> {
    const detail = await this.readDetail(organizationId, actorUserId);

    await this.audit.record({
      action: AUDIT_ACTIONS.platformOrganizationViewed,
      organizationId,
      actorUserId,
      targetType: 'organization',
      targetId: organizationId,
    });

    return detail;
  }

  async create(
    input: CreatePlatformOrganizationRequest,
    actorUserId: string,
  ): Promise<PlatformOrganizationDetail> {
    const owner = await this.repository.findOwnerAccount(input.ownerEmail);

    if (!owner) {
      throw AppException.unprocessable(
        'owner_not_found',
        'No account exists for that address. Ask the owner to register first.',
      );
    }

    const problem = accountOnboardingProblem(owner);

    if (problem === 'suspended') {
      throw AppException.unprocessable(
        'owner_not_available',
        'That account is suspended and cannot administer a workspace.',
      );
    }

    if (problem === 'unverified') {
      throw AppException.unprocessable(
        'owner_not_available',
        'That account has not verified its email address yet.',
      );
    }

    const created = await this.provisioning.provision({
      name: input.name,
      ...(input.slug ? { slug: input.slug } : {}),
      timeZone: input.timeZone,
      defaultLocale: input.defaultLocale,
      ownerUserId: owner.id,
      actorUserId,
    });

    return this.readDetail(created.organization.id, actorUserId);
  }

  async updateStatus(
    organizationId: string,
    input: UpdateOrganizationStatusRequest,
    actorUserId: string,
  ): Promise<PlatformOrganizationDetail> {
    const current = await this.tenantTransaction.withPlatformAdmin(
      actorUserId,
      (tx) => this.repository.findStatus(tx, organizationId),
    );

    if (!current) {
      throw AppException.notFound('tenant_not_found', 'Workspace not found.');
    }

    if (current.status === input.status) {
      return this.readDetail(organizationId, actorUserId);
    }

    await this.tenantTransaction.withPlatformAdmin(actorUserId, async (tx) => {
      const changed = await this.repository.updateStatus(
        tx,
        organizationId,
        input.status,
      );

      if (changed === 0) {
        throw AppException.notFound('tenant_not_found', 'Workspace not found.');
      }
    });

    await this.audit.record({
      action:
        input.status === 'SUSPENDED'
          ? AUDIT_ACTIONS.organizationSuspended
          : AUDIT_ACTIONS.organizationReactivated,
      organizationId,
      actorUserId,
      targetType: 'organization',
      targetId: organizationId,
      metadata: {
        status: input.status,
        ...(input.reason ? { reason: input.reason } : {}),
      },
    });

    return this.readDetail(organizationId, actorUserId);
  }

  private async readDetail(
    organizationId: string,
    actorUserId: string,
  ): Promise<PlatformOrganizationDetail> {
    return this.tenantTransaction.withPlatformSupport(actorUserId, async (tx) => {
      const [row, members] = await Promise.all([
        this.repository.findOverview(tx, organizationId),
        this.repository.memberStatusCounts(tx, organizationId),
      ]);

      if (!row) {
        throw AppException.notFound('tenant_not_found', 'Workspace not found.');
      }

      return toPlatformOrganizationDetail(row, members);
    });
  }
}
