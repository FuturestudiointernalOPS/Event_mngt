import { Injectable } from '@nestjs/common';
import {
  getModuleDefinition,
  validateModuleSettings,
  type EventModule,
  type ModuleCatalogueEntry,
  type UpdateEventModulesRequest,
} from '@event-platform/shared';
import { AppException } from '../../common/app-exception';
import { AUDIT_ACTIONS } from '../../common/audit/audit.actions';
import { AuditService } from '../../common/audit/audit.service';
import { TenantTransactionService } from '../../database/tenant-transaction.service';
import type { TenantPrismaClient } from '../../database/tenant-transaction.service';
import { toCatalogue, toEventModules } from './module-registry.mapper';
import { ModuleRegistryRepository } from './module-registry.repository';
import {
  applyChanges,
  assertCoreNotDisabled,
  assertDependenciesMet,
  assertKnownModules,
  assertKnownSettings,
  assertNoDuplicateChanges,
  assertNoEnabledDependentDisabled,
} from './module-registry.rules';

/**
 * Enabling, configuring and disabling event modules.
 *
 * Every write stays inside one tenant transaction: a half-applied change (module on,
 * its dependency off) would leave the event in a state no UI could explain.
 */
@Injectable()
export class ModuleRegistryService {
  constructor(
    private readonly tenantTransaction: TenantTransactionService,
    private readonly repository: ModuleRegistryRepository,
    private readonly audit: AuditService,
  ) {}

  catalogue(): ModuleCatalogueEntry[] {
    return toCatalogue();
  }

  /**
   * Feature gate for a route whose module must be on. Unlike `requireEnabledSettings`,
   * this reports the refusal as `module_not_enabled` because the caller is staff and
   * may legitimately see that the event exists.
   */
  async requireEnabled(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
    moduleKey: string,
  ): Promise<void> {
    const row = await this.repository.findModuleRow(
      tx,
      organizationId,
      eventId,
      moduleKey,
    );

    if (!row || !row.enabled) {
      throw AppException.unprocessable(
        'module_not_enabled',
        `The "${moduleKey}" module is not enabled for this event.`,
      );
    }
  }

  /**
   * Effective settings for an enabled module, for features in other modules (R10).
   *
   * Runs inside the caller's tenant transaction so the caller keeps one boundary. A
   * module that is missing or disabled is reported exactly like a missing event, so a
   * closed registration page cannot be used to probe an event's existence.
   */
  async requireEnabledSettings(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
    moduleKey: string,
  ): Promise<Record<string, unknown>> {
    const row = await this.repository.findModuleRow(
      tx,
      organizationId,
      eventId,
      moduleKey,
    );

    if (!row || !row.enabled) {
      throw AppException.notFound('not_found', 'Event not found.');
    }

    const definition = getModuleDefinition(moduleKey);
    const parsed = validateModuleSettings(
      moduleKey,
      row.settings ?? definition?.defaults ?? {},
    );

    return parsed.success ? parsed.data : (definition?.defaults ?? {});
  }

  list(eventId: string): Promise<EventModule[]> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      await this.assertEvent(tx, tenant.organizationId, eventId);
      const rows = await this.repository.listRows(tx, tenant.organizationId, eventId);
      return toEventModules(rows);
    });
  }

  async update(
    eventId: string,
    input: UpdateEventModulesRequest,
  ): Promise<EventModule[]> {
    const changes = input.modules;
    assertNoDuplicateChanges(changes);
    assertKnownModules(changes);
    assertCoreNotDisabled(changes);

    const updated = await this.tenantTransaction.withTenant(async (tx, tenant) => {
      await this.assertEvent(tx, tenant.organizationId, eventId);

      const rows = await this.repository.listRows(tx, tenant.organizationId, eventId);
      const currentEnabled = rows.filter((row) => row.enabled).map((row) => row.moduleKey);
      const nextEnabled = applyChanges(currentEnabled, changes);

      assertDependenciesMet(nextEnabled);
      assertNoEnabledDependentDisabled(currentEnabled, nextEnabled);

      for (const change of changes) {
        const existing = rows.find((row) => row.moduleKey === change.key);

        if (!change.enabled) {
          // Disabling flips the flag and keeps the settings for a later re-enable.
          await this.repository.upsert(tx, eventId, change.key, false, undefined);
          continue;
        }

        const settings = this.settingsFor(change.key, change.settings, existing?.settings);
        await this.repository.upsert(tx, eventId, change.key, true, settings);
      }

      return toEventModules(
        await this.repository.listRows(tx, tenant.organizationId, eventId),
      );
    });

    await this.audit.record({
      action: AUDIT_ACTIONS.eventModulesUpdated,
      targetType: 'event',
      targetId: eventId,
      metadata: { changed: changes.map((change) => change.key) },
    });

    return updated;
  }

  /**
   * Settings are validated by the same registry definition the client uses. A module
   * enabled for the first time without settings receives its documented defaults; an
   * existing row keeps what it had when the request does not mention settings.
   */
  private settingsFor(
    key: string,
    requested: Record<string, unknown> | undefined,
    existing: unknown,
  ): Record<string, unknown> | undefined {
    if (requested === undefined) {
      if (existing !== undefined && existing !== null) {
        return undefined;
      }

      const definition = getModuleDefinition(key);
      const defaults = definition?.defaults ?? {};
      return this.validateSettings(key, defaults);
    }

    assertKnownSettings(key, requested);
    return this.validateSettings(key, requested);
  }

  private validateSettings(
    key: string,
    settings: Record<string, unknown>,
  ): Record<string, unknown> {
    const parsed = validateModuleSettings(key, settings);

    if (!parsed.success) {
      throw AppException.unprocessable(
        'invalid_module_settings',
        `The settings for "${key}" are invalid.`,
        parsed.issues,
      );
    }

    return parsed.data;
  }

  private async assertEvent(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
  ): Promise<void> {
    const event = await this.repository.eventExists(tx, organizationId, eventId);

    if (!event) {
      throw AppException.notFound('not_found', 'Event not found.');
    }
  }
}
