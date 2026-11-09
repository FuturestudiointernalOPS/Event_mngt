import { Injectable } from '@nestjs/common';
import {
  EventModuleView,
  MODULE_REGISTRY,
  SetEventModuleRequest,
} from '@event-platform/shared';
import { writeAudit } from '../../common/audit/audit';
import { AppException } from '../../common/app-exception';
import { EventStatus } from '../../database/prisma-client';
import { TenantTransactionService } from '../../database/tenant-transaction.service';
import type { TenantPrismaClient } from '../../database/tenant-transaction.service';
import { isModuleAvailable, planModuleChange } from './event-modules.rules';

type ModuleRow = { moduleKey: string; enabled: boolean; settings: unknown };

/** Per-event module activation against the controlled registry. */
@Injectable()
export class EventModulesService {
  constructor(private readonly tenantTransaction: TenantTransactionService) {}

  list(eventId: string): Promise<EventModuleView[]> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      await this.requireEvent(tx, tenant.organizationId, eventId);
      return this.view(await this.rows(tx, eventId), await this.platformDisabled(tx));
    });
  }

  set(eventId: string, key: string, input: SetEventModuleRequest): Promise<EventModuleView[]> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const event = await this.requireEvent(tx, tenant.organizationId, eventId);

      if (event.status === EventStatus.ARCHIVED || event.status === EventStatus.CANCELLED) {
        throw AppException.unprocessable(
          'event_not_editable',
          'The modules of a cancelled or archived event cannot be changed.',
        );
      }

      const rows = await this.rows(tx, eventId);
      const platformDisabled = await this.platformDisabled(tx);
      const enabledKeys = rows.filter((row) => row.enabled).map((row) => row.moduleKey);

      const plan = planModuleChange({
        key,
        enable: input.enabled,
        enabledKeys,
        settings: input.settings,
        platformDisabled,
      });

      // Disabling keeps the row and its settings: historical records are never deleted.
      await tx.eventModule.upsert({
        where: { eventId_moduleKey: { eventId, moduleKey: key } },
        create: {
          eventId,
          moduleKey: key,
          enabled: input.enabled,
          settings: input.enabled ? (plan.settings as object) : {},
        },
        update: input.enabled
          ? { enabled: true, settings: plan.settings as object }
          : { enabled: false },
      });

      await writeAudit(tx, {
        organizationId: tenant.organizationId,
        actorUserId: tenant.userId,
        action: input.enabled ? 'event.module_enabled' : 'event.module_disabled',
        targetType: 'event',
        targetId: eventId,
        metadata: { module: key },
      });

      return this.view(await this.rows(tx, eventId), platformDisabled);
    });
  }

  private async platformDisabled(tx: TenantPrismaClient): Promise<string[]> {
    const rows = await tx.platformModuleSetting.findMany({ where: { available: false }, select: { moduleKey: true } });
    return rows.map((row) => row.moduleKey);
  }

  private rows(tx: TenantPrismaClient, eventId: string): Promise<ModuleRow[]> {
    return tx.eventModule.findMany({
      where: { eventId },
      select: { moduleKey: true, enabled: true, settings: true },
    });
  }

  private async requireEvent(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
  ): Promise<{ id: string; status: EventStatus }> {
    const event = await tx.event.findFirst({
      where: { id: eventId, organizationId },
      select: { id: true, status: true },
    });

    if (!event) {
      throw AppException.notFound('not_found', 'Event not found.');
    }

    return event;
  }

  private view(rows: ModuleRow[], platformDisabled: string[]): EventModuleView[] {
    const byKey = new Map(rows.map((row) => [row.moduleKey, row]));

    return MODULE_REGISTRY.map((definition) => {
      const row = byKey.get(definition.key);
      return {
        key: definition.key,
        name: definition.name,
        summary: definition.summary,
        priority: definition.priority,
        dependsOn: definition.dependsOn,
        configurable: definition.configurable,
        available: isModuleAvailable(definition) && !platformDisabled.includes(definition.key),
        enabled: row?.enabled ?? false,
        settings: (row?.settings as Record<string, unknown> | null) ?? {},
      };
    });
  }
}
