import { Injectable } from '@nestjs/common';
import {
  MODULE_REGISTRY,
  type PlatformModuleView,
  type PlatformOverview,
  type SetOrganisationStatusRequest,
} from '@event-platform/shared';
import { writeAudit } from '../../common/audit/audit';
import { AppException } from '../../common/app-exception';
import { UserStatus } from '../../database/prisma-client';
import { PrismaService } from '../../database/prisma.service';
import { TenantTransactionService } from '../../database/tenant-transaction.service';

/**
 * Super Admin operations. The platform-administrator flag is re-read from the database on
 * every call: the access token's claim is only a hint and may be stale after a demotion.
 */
@Injectable()
export class PlatformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantTransaction: TenantTransactionService,
  ) {}

  async overview(userId: string): Promise<PlatformOverview> {
    await this.assertPlatformAdmin(userId);

    return this.tenantTransaction.withPlatform(null, async (tx) => {
      const [organisations, events, registrations] = await Promise.all([
        tx.organization.findMany({
          orderBy: { createdAt: 'desc' },
          select: { id: true, slug: true, name: true, status: true, createdAt: true, _count: { select: { events: true } } },
        }),
        tx.event.count(),
        tx.registration.count(),
      ]);

      return {
        organisations: {
          total: organisations.length,
          active: organisations.filter((o) => o.status === 'ACTIVE').length,
        },
        events,
        registrations,
        organisationList: organisations.map((o) => ({
          id: o.id,
          slug: o.slug,
          name: o.name,
          status: o.status,
          events: o._count.events,
          createdAt: o.createdAt.toISOString(),
        })),
      };
    });
  }

  async setStatus(userId: string, organizationId: string, input: SetOrganisationStatusRequest): Promise<void> {
    await this.assertPlatformAdmin(userId);

    await this.tenantTransaction.withPlatform(organizationId, async (tx) => {
      const result = await tx.organization.updateMany({
        where: { id: organizationId },
        data: { status: input.status },
      });
      if (result.count === 0) {
        throw AppException.notFound('not_found', 'Organisation not found.');
      }
      await writeAudit(tx, {
        organizationId,
        actorUserId: userId,
        action: `platform.organization_${input.status.toLowerCase()}`,
        targetType: 'organization',
        targetId: organizationId,
      });
    });
  }

  async listModules(userId: string): Promise<PlatformModuleView[]> {
    await this.assertPlatformAdmin(userId);
    const off = new Set(
      (await this.prisma.platformModuleSetting.findMany({ where: { available: false } })).map((r) => r.moduleKey),
    );
    return MODULE_REGISTRY.map((m) => ({
      key: m.key,
      name: m.name,
      priority: m.priority,
      available: (m.priority === 'core' || m.priority === 'p0') && !off.has(m.key),
      locked: m.priority !== 'p0',
    }));
  }

  async setModuleAvailability(userId: string, key: string, available: boolean): Promise<void> {
    await this.assertPlatformAdmin(userId);
    const definition = MODULE_REGISTRY.find((m) => m.key === key);

    if (!definition) {
      throw AppException.notFound('module_not_found', 'This module does not exist.');
    }
    if (definition.priority !== 'p0') {
      throw AppException.unprocessable('module_locked', 'The availability of this module cannot be changed.');
    }

    await this.prisma.platformModuleSetting.upsert({
      where: { moduleKey: key },
      create: { moduleKey: key, available },
      update: { available },
    });
  }

  private async assertPlatformAdmin(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isPlatformAdmin: true, status: true },
    });

    if (!user?.isPlatformAdmin || user.status !== UserStatus.ACTIVE) {
      throw AppException.forbidden('platform_admin_required', 'This area is for platform administrators.');
    }
  }
}
