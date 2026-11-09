import { Injectable } from '@nestjs/common';
import type { TenantPrismaClient } from '../../database/tenant-transaction.service';
import { Prisma, type EventModule as EventModuleRow } from '../../database/prisma-client';

/**
 * Module rows for one event.
 *
 * The event existence check lives here because activation must be decided inside the
 * same tenant transaction that writes the rows; importing another module's repository
 * is forbidden, but a read against a tenant-owned table inside our own repository is
 * the supported seam (R10 applies to imports, not to SQL).
 */
@Injectable()
export class ModuleRegistryRepository {
  eventExists(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
  ): Promise<{ id: string } | null> {
    return tx.event.findFirst({
      where: { id: eventId, organizationId },
      select: { id: true },
    });
  }

  listRows(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
  ): Promise<EventModuleRow[]> {
    return tx.eventModule.findMany({
      where: { eventId, event: { organizationId } },
      orderBy: { moduleKey: 'asc' },
    });
  }

  async upsert(
    tx: TenantPrismaClient,
    eventId: string,
    moduleKey: string,
    enabled: boolean,
    settings: Record<string, unknown> | undefined,
  ): Promise<void> {
    await tx.eventModule.upsert({
      where: { eventId_moduleKey: { eventId, moduleKey } },
      create: {
        eventId,
        moduleKey,
        enabled,
        settings:
          settings === undefined ? Prisma.DbNull : (settings as Prisma.InputJsonValue),
      },
      update:
        settings === undefined
          ? { enabled }
          : { enabled, settings: settings as Prisma.InputJsonValue },
    });
  }
}
