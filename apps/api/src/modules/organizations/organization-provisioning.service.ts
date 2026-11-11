import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { OrganizationOnboardingResult } from '@event-platform/shared';
import { AppException } from '../../common/app-exception';
import { AUDIT_ACTIONS } from '../../common/audit/audit.actions';
import { AuditService } from '../../common/audit/audit.service';
import { ensureUniqueSlug, slugify } from '../../common/utils/slug';
import { TenantTransactionService } from '../../database/tenant-transaction.service';
import type { TenantPrismaClient } from '../../database/tenant-transaction.service';
import { OrganizationsRepository } from './organizations.repository';
import {
  ADMIN_ROLE_KEY,
  defaultEntitlementKeys,
  rolePermissionKeys,
  roleProvisioningPlans,
  type ProvisionOrganizationInput,
} from './organizations.rules';

/**
 * Creates a complete, usable organisation in one transaction.
 *
 * The organisation id is generated here, so the transaction can open that tenant's scope
 * before the first insert. Every row RLS protects — the organisation, settings, branding,
 * entitlements, roles, role grants and the first membership — is written inside it.
 * Slug uniqueness is checked in the same scope and the database constraint remains the
 * final guarantee.
 */
@Injectable()
export class OrganizationProvisioningService {
  private readonly logger = new Logger(OrganizationProvisioningService.name);

  constructor(
    private readonly tenantTransaction: TenantTransactionService,
    private readonly repository: OrganizationsRepository,
    private readonly audit: AuditService,
  ) {}

  async provision(
    input: ProvisionOrganizationInput,
  ): Promise<OrganizationOnboardingResult> {
    const organizationId = randomUUID();

    try {
      const provisioned = await this.tenantTransaction.withOrganizationProvisioning(
        organizationId,
        input.actorUserId,
        async (tx) => {
          const slug = await this.resolveSlug(tx, input);

          const plans = roleProvisioningPlans();
          const requiredPermissions = rolePermissionKeys(plans);
          const permissionRows = await this.repository.findPermissionsByKeys(
            tx,
            requiredPermissions,
          );
          const permissionIdByKey = new Map(
            permissionRows.map((row) => [row.key, row.id]),
          );
          const missing = requiredPermissions.filter(
            (key) => !permissionIdByKey.has(key),
          );

          if (missing.length > 0) {
            this.logger.error(
              `Cannot provision organisation: permission catalogue is missing ${missing.join(', ')}.`,
            );
            throw AppException.internal(
              'organization_setup_failed',
              'Workspace setup is unavailable right now.',
            );
          }

          const organization = await this.repository.createOrganization(tx, {
            id: organizationId,
            slug,
            name: input.name,
            timeZone: input.timeZone,
            defaultLocale: input.defaultLocale,
          });

          await this.repository.createWorkspaceDefaults(tx, organizationId, {
            timeZone: input.timeZone,
            defaultLocale: input.defaultLocale,
          });

          await this.repository.createEntitlements(
            tx,
            organizationId,
            defaultEntitlementKeys(),
            input.actorUserId,
          );

          const roles = await this.repository.createSystemRoles(
            tx,
            organizationId,
            plans,
            permissionIdByKey,
          );
          const adminRole = roles.get(ADMIN_ROLE_KEY);

          if (!adminRole) {
            throw AppException.internal(
              'organization_setup_failed',
              'Workspace setup is unavailable right now.',
            );
          }

          const member = await this.repository.createMembership(tx, {
            organizationId,
            userId: input.ownerUserId,
            roleId: adminRole.id,
          });

          return {
            organization: {
              id: organization.id,
              slug: organization.slug,
              name: organization.name,
              status: 'ACTIVE' as const,
              createdAt: organization.createdAt.toISOString(),
            },
            member: {
              id: member.id,
              roleId: adminRole.id,
              roleKey: adminRole.key,
              status: 'ACTIVE' as const,
            },
          };
        },
      );

      await this.audit.record({
        action: AUDIT_ACTIONS.organizationCreated,
        organizationId,
        actorUserId: input.actorUserId,
        targetType: 'organization',
        targetId: organizationId,
        metadata: { slug: provisioned.organization.slug },
      });

      return provisioned;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw AppException.conflict(
          'slug_taken',
          'That workspace web address is already in use.',
        );
      }

      throw error;
    }
  }

  private async resolveSlug(
    tx: TenantPrismaClient,
    input: ProvisionOrganizationInput,
  ): Promise<string> {
    if (input.slug) {
      const slug = slugify(input.slug);

      if (await this.repository.slugExists(tx, slug)) {
        throw AppException.conflict(
          'slug_taken',
          'That workspace web address is already in use.',
        );
      }

      return slug;
    }

    return ensureUniqueSlug(
      input.name,
      async (candidate) => (await this.repository.slugExists(tx, candidate)) !== null,
      'workspace',
    );
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}
