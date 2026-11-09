import { Injectable, Logger } from '@nestjs/common';
import type { AuditEntry, AuditQuery } from '@event-platform/shared';
import type { PaginatedResult } from '../types/authenticated-user';
import { Prisma } from '../../database/prisma-client';
import { TenantContextService } from '../../database/tenant-context.service';
import { TenantTransactionService } from '../../database/tenant-transaction.service';
import type { AuditAction } from './audit.actions';
import { toAuditEntry } from './audit.mapper';
import { redactMetadata } from './audit.redaction';
import { AuditRepository } from './audit.repository';

export interface AuditEntryInput {
  action: AuditAction;
  targetType: string;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
  /** Defaults to the current tenant and actor when a request context exists. */
  organizationId?: string | null;
  actorUserId?: string | null;
  ipAddress?: string | null;
  requestId?: string | null;
}

/**
 * Append-only audit trail.
 *
 * Recording never breaks the operation it describes: a failed write is logged and
 * swallowed. It also never guesses: an entry with no organisation and no actor is
 * dropped rather than attributed to nobody.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    private readonly tenantTransaction: TenantTransactionService,
    private readonly tenantContext: TenantContextService,
    private readonly repository: AuditRepository,
  ) {}

  async record(entry: AuditEntryInput): Promise<void> {
    const context = this.tenantContext.get();
    const organizationId = entry.organizationId ?? context?.organizationId ?? null;
    const actorUserId = entry.actorUserId ?? context?.userId ?? null;

    if (!organizationId && !actorUserId) {
      return;
    }

    const data: Prisma.AuditLogUncheckedCreateInput = {
      organizationId,
      actorUserId,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId ?? null,
      metadata:
        entry.metadata === undefined
          ? Prisma.DbNull
          : (redactMetadata(entry.metadata) as Prisma.InputJsonValue),
      ipAddress: entry.ipAddress ?? context?.ipAddress ?? null,
      requestId: entry.requestId ?? context?.requestId ?? null,
    };

    try {
      if (organizationId) {
        if (!context) {
          this.logger.warn(`Audit ${entry.action} skipped: no tenant context to write into.`);
          return;
        }
        await this.tenantTransaction.withTenant(async (tx) => {
          await tx.auditLog.create({ data });
        });
        return;
      }

      // No organisation (sign-in): the row must be attributed to the account itself,
      // which the database policy checks on insert.
      await this.tenantTransaction.withUserScope(actorUserId as string, async (tx) => {
        await tx.auditLog.create({ data });
      });
    } catch (error) {
      this.logger.warn(
        `Audit write failed for ${entry.action}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  list(query: AuditQuery): Promise<PaginatedResult<AuditEntry>> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const [rows, total] = await this.repository.list(
        tx,
        tenant.organizationId,
        query.page,
        query.pageSize,
      );

      return {
        items: rows.map(toAuditEntry),
        page: query.page,
        pageSize: query.pageSize,
        total,
      };
    });
  }
}
