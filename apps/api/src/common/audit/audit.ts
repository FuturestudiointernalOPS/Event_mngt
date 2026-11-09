import type { TenantPrismaClient } from '../../database/tenant-transaction.service';

export interface AuditEntry {
  organizationId: string;
  actorUserId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Writes one audit row inside the caller's tenant transaction, so the record commits or
 * rolls back with the change it describes. Callers pass the transaction client; this is
 * not a service because there is nothing to inject.
 */
export async function writeAudit(tx: TenantPrismaClient, entry: AuditEntry): Promise<void> {
  await tx.auditLog.create({
    data: {
      organizationId: entry.organizationId,
      actorUserId: entry.actorUserId ?? null,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId ?? null,
      metadata: (entry.metadata ?? {}) as object,
    },
  });
}
