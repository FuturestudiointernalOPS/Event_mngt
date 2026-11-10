import { Injectable, Logger } from '@nestjs/common';
import { TenantContextService, type TenantContext } from '../../database/tenant-context.service';
import { TenantTransactionService } from '../../database/tenant-transaction.service';
import {
  EXPORT_FAILURE_MESSAGE,
  MAX_EXPORT_ROWS,
} from './report-exports.rules';
import { ReportExportRowsRepository } from './report-export-rows.repository';
import { ReportExportsRepository } from './report-exports.repository';
import { capRows, renderExport } from './report-files';

export interface ExportProcessOptions {
  /** 1-based attempt number supplied by the durable queue. */
  attempt?: number;
  /** Total attempts the queue will make; a retry is only recorded when more remain. */
  maxAttempts?: number;
}

/**
 * The export worker.
 *
 * `enqueue` is the in-process fallback used when Redis is not configured; the durable
 * `ReportExportQueue` calls `process` directly. `process` re-enters the tenant
 * explicitly, claims the row atomically, snapshots the data and records the outcome.
 * A retryable failure is released back to PENDING before being rethrown, so BullMQ can
 * try again; the final failure is written in its own transaction.
 */
@Injectable()
export class ReportExportWorker {
  private readonly logger = new Logger(ReportExportWorker.name);

  constructor(
    private readonly tenantTransaction: TenantTransactionService,
    private readonly repository: ReportExportsRepository,
    private readonly rows: ReportExportRowsRepository,
  ) {}

  enqueue(exportId: string, context: TenantContext): void {
    setImmediate(() => {
      void this.process(exportId, context);
    });
  }

  /** Public for the worker and for tests; false means the row was not claimed. */
  async process(
    exportId: string,
    context: TenantContext,
    options: ExportProcessOptions = {},
  ): Promise<boolean> {
    const attempt = options.attempt ?? 1;
    const maxAttempts = options.maxAttempts ?? 1;

    try {
      const prepared = await this.tenantTransaction.withTenantContext(
        context,
        async (tx, tenant) => {
          const row = await this.repository.claim(
            tx,
            tenant.organizationId,
            exportId,
            attempt > 1,
          );

          if (!row) {
            return null;
          }

          const [event, rows] = await Promise.all([
            this.repository.findEvent(tx, tenant.organizationId, row.eventId),
            this.rows.registrationRows(
              tx,
              tenant.organizationId,
              row.eventId,
              MAX_EXPORT_ROWS + 1,
            ),
          ]);

          const capped = capRows(rows);

          return renderExport(row.format, {
            rows: capped.rows,
            truncated: capped.truncated,
            eventName: event?.name ?? 'Event',
            generatedAt: new Date(),
          });
        },
      );

      if (!prepared) {
        return false;
      }

      await this.tenantTransaction.withTenantContext(context, (tx, tenant) =>
        this.repository.complete(tx, tenant.organizationId, exportId, {
          content: prepared.content,
          rowCount: prepared.rowCount,
          byteSize: prepared.content.byteLength,
          truncated: prepared.truncated,
          completedAt: new Date(),
        }),
      );

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (attempt < maxAttempts) {
        this.logger.warn(`Export ${exportId} failed (attempt ${attempt}); retrying: ${message}`);
        await this.tenantTransaction
          .withTenantContext(context, (tx, tenant) =>
            this.repository.release(tx, tenant.organizationId, exportId),
          )
          .catch((failure) => {
            this.logger.error(
              `Export ${exportId} could not be released for retry: ${
                failure instanceof Error ? failure.message : String(failure)
              }`,
            );
          });

        throw error;
      }

      this.logger.error(`Export ${exportId} failed: ${message}`);

      await this.tenantTransaction
        .withTenantContext(context, (tx, tenant) =>
          this.repository.fail(
            tx,
            tenant.organizationId,
            exportId,
            EXPORT_FAILURE_MESSAGE,
          ),
        )
        .catch((failure) => {
          this.logger.error(
            `Export ${exportId} could not record its failure: ${
              failure instanceof Error ? failure.message : String(failure)
            }`,
          );
        });

      return false;
    }
  }
}
