import { Injectable } from '@nestjs/common';
import type { PaginationQuery } from '@event-platform/shared';
import type { PaginatedResult } from '../../common/types/authenticated-user';
import { TenantTransactionService } from '../../database/tenant-transaction.service';

export interface AuditLogView {
  id: string;
  action: string;
  targetType: string;
  targetId: string | null;
  actorEmail: string | null;
  createdAt: string;
}

/** Read-only audit trail of the workspace. */
@Injectable()
export class AuditService {
  constructor(private readonly tenantTransaction: TenantTransactionService) {}

  list(query: PaginationQuery): Promise<PaginatedResult<AuditLogView>> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const where = { organizationId: tenant.organizationId };
      const [rows, total] = await Promise.all([
        tx.auditLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          include: { actor: { select: { email: true } } },
        }),
        tx.auditLog.count({ where }),
      ]);

      return {
        items: rows.map((row) => ({
          id: row.id,
          action: row.action,
          targetType: row.targetType,
          targetId: row.targetId,
          actorEmail: row.actor?.email ?? null,
          createdAt: row.createdAt.toISOString(),
        })),
        page: query.page,
        pageSize: query.pageSize,
        total,
      };
    });
  }
}
