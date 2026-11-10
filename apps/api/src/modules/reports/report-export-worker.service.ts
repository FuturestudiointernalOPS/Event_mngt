import { Injectable, Logger } from '@nestjs/common';
import { TenantContextService, type TenantContext } from '../../database/tenant-context.service';
import { TenantTransactionService } from '../../database/tenant-transaction.service';
import {
  EXPORT_FAILURE_MESSAGE,
  MAX_EXPORT_ROWS,
} from './report-exports.rules';
import { ReportExportsRepository } from './report-exports.repository';
import { capRows, renderExport } from './report-files';

/**
 * The export worker (WP-19).
 *
 * `enqueue` is the queue seam: today it schedules on the event loop, and swapping in
 * BullMQ means replacing this method only. `process` re-enters the tenant explicitly,
 * claims the row atomically, snapshots the data and records either outcome. The failure
 * is written in its own transaction, so a rolled-back generation cannot hide the error.
 */
@Injectable()
export class ReportExportWorker {
  private readonly logger = new Logger(ReportExportWorker.name);

  constructor(
    private readonly tenantTransaction: TenantTransactionService,
    private readonly repository: ReportExportsRepository,
  ) {}

  enqueue(exportId: string, context: TenantContext): void {
    setImmediate(() => {
      void this.process(exportId, context);
    });
  }

  /** Public for the worker and for tests; false means the row was not claimed. */
  async process(exportId: string, context: TenantContext): Promise<boolean> {
    try {
      const prepared = await this.tenantTransaction.withTenantContext(
        context,
        async (tx, tenant) => {
          const row = await this.repository.claim(
            tx,
            tenant.organizationId,
            exportId,
          );

          if (!row) {
            return null;
          }

          const [event, rows] = await Promise.all([
            this.repository.findEvent(tx, tenant.organizationId, row.eventId),
            this.repository.registrationRows(
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
      this.logger.error(
        `Export ${exportId} failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

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
