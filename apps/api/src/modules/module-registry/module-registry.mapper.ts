import {
  MODULE_REGISTRY,
  type EventModule,
  type ModuleCatalogueEntry,
} from '@event-platform/shared';
import type { EventModule as EventModuleRow } from '../../database/prisma-client';

/**
 * Projections for the registry. The catalogue deliberately drops `settingsSchema`:
 * a Zod type is not a wire shape, and the client validates forms with the shared
 * definition directly.
 */
export function toCatalogue(): ModuleCatalogueEntry[] {
  return MODULE_REGISTRY.map((definition) => ({
    key: definition.key,
    name: definition.name,
    summary: definition.summary,
    priority: definition.priority,
    dependsOn: [...definition.dependsOn],
    requiredPermissions: [...definition.requiredPermissions],
    configurable: definition.configurable,
  }));
}

/**
 * Every catalogue entry appears, whether or not the event has a row for it. An absent
 * row means "not enabled"; this keeps the response stable as the catalogue grows.
 */
export function toEventModules(rows: readonly EventModuleRow[]): EventModule[] {
  const byKey = new Map(rows.map((row) => [row.moduleKey, row]));

  return MODULE_REGISTRY.map((definition) => {
    const row = byKey.get(definition.key);

    return {
      key: definition.key,
      enabled: row?.enabled ?? false,
      settings: row?.settings ?? null,
    };
  });
}
