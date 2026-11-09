import { Injectable } from '@nestjs/common';
import {
  CreateOrganizationRequest,
  DEFAULT_BRANDING,
  SYSTEM_ROLES,
  SYSTEM_ROLE_TEMPLATES,
} from '@event-platform/shared';
import { randomUUID } from 'node:crypto';
import { AppException } from '../../common/app-exception';
import { ensureUniqueSlug, slugify } from '../../common/utils/slug';
import { MemberStatus, OrganizationStatus } from '../../database/prisma-client';
import { PrismaService } from '../../database/prisma.service';
import { TenantTransactionService } from '../../database/tenant-transaction.service';
import type { TenantPrismaClient } from '../../database/tenant-transaction.service';

export interface CreatedOrganization {
  id: string;
  slug: string;
  name: string;
}

/**
 * Workspace creation. The new organisation id is generated up front so the whole
 * provisioning (organisation, settings, branding, system roles, first administrator)
 * runs inside that organisation's own row-level scope.
 */
@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantTransaction: TenantTransactionService,
  ) {}

  async create(input: CreateOrganizationRequest, userId: string): Promise<CreatedOrganization> {
    const slug = input.slug
      ? slugify(input.slug)
      : await ensureUniqueSlug(input.name, async (candidate) => this.slugExists(candidate));

    if (await this.slugExists(slug)) {
      throw AppException.conflict('slug_taken', 'This workspace address is already taken.');
    }

    const organizationId = randomUUID();

    return this.tenantTransaction.withOrganization(organizationId, userId, async (tx) => {
      await tx.organization.create({
        data: {
          id: organizationId,
          slug,
          name: input.name,
          status: OrganizationStatus.ACTIVE,
          settings: {
            create: { defaultLocale: input.defaultLocale, timeZone: input.timeZone },
          },
          branding: { create: { ...DEFAULT_BRANDING } },
        },
      });

      const adminRoleId = await this.provisionSystemRoles(tx, organizationId);

      await tx.organizationMember.create({
        data: {
          organizationId,
          userId,
          roleId: adminRoleId,
          status: MemberStatus.ACTIVE,
          joinedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          actorUserId: userId,
          action: 'organization.created',
          targetType: 'organization',
          targetId: organizationId,
        },
      });

      return { id: organizationId, slug, name: input.name };
    });
  }

  private async slugExists(slug: string): Promise<boolean> {
    const found = await this.prisma.organization.findUnique({
      where: { slug },
      select: { id: true },
    });
    return found !== null;
  }

  /** Creates the six system roles with their permissions; returns the admin role id. */
  private async provisionSystemRoles(
    tx: TenantPrismaClient,
    organizationId: string,
  ): Promise<string> {
    const catalogue = await tx.permission.findMany({ select: { id: true, key: true } });

    if (catalogue.length === 0) {
      throw new Error('The permission catalogue is empty. Run the database seed first.');
    }

    const idByKey = new Map(catalogue.map((entry) => [entry.key, entry.id]));
    let adminRoleId = '';

    for (const template of SYSTEM_ROLE_TEMPLATES) {
      const role = await tx.organizationRole.create({
        data: {
          organizationId,
          key: template.key,
          name: template.name,
          description: template.description,
          isSystem: true,
          permissions: {
            create: template.permissions
              .map((key) => idByKey.get(key))
              .filter((id): id is string => id !== undefined)
              .map((permissionId) => ({ permissionId })),
          },
        },
      });

      if (template.key === SYSTEM_ROLES.organisationAdmin) {
        adminRoleId = role.id;
      }
    }

    return adminRoleId;
  }
}
