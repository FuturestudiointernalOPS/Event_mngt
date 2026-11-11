import type { AuditEntry } from '@event-platform/shared';

export interface AuditActorRow {
  id: string;
  email: string;
  displayName: string | null;
}

export interface AuditRow {
  id: string;
  action: string;
  targetType: string;
  targetId: string | null;
  metadata: unknown;
  ipAddress: string | null;
  requestId: string | null;
  createdAt: Date;
  actor: AuditActorRow | null;
}

export function toAuditEntry(row: AuditRow): AuditEntry {
  return {
    id: row.id,
    action: row.action,
    targetType: row.targetType,
    targetId: row.targetId,
    actor: row.actor
      ? { id: row.actor.id, email: row.actor.email, displayName: row.actor.displayName }
      : null,
    metadata: row.metadata ?? null,
    ipAddress: row.ipAddress,
    requestId: row.requestId,
    createdAt: row.createdAt.toISOString(),
  };
}
