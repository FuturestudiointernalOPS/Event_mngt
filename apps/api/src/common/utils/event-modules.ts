import { AppException } from '../app-exception';
import type { TenantPrismaClient } from '../../database/tenant-transaction.service';

/**
 * Returns the settings of an enabled module, or refuses with a stable code. Features call
 * this so a disabled module is unreachable, not merely hidden in the UI.
 */
export async function requireModule(
  tx: TenantPrismaClient,
  eventId: string,
  moduleKey: string,
): Promise<Record<string, unknown>> {
  const row = await tx.eventModule.findUnique({
    where: { eventId_moduleKey: { eventId, moduleKey } },
    select: { enabled: true, settings: true },
  });

  if (!row?.enabled) {
    throw AppException.notFound('module_disabled', 'This feature is not enabled for this event.');
  }

  return (row.settings ?? {}) as Record<string, unknown>;
}
