import type { ReportExport } from '@event-platform/shared';
import type { ReportExportMetaRow } from './report-exports.repository';

/** Row to contract. Dates are ISO strings; the stored bytes never leave this mapper. */
export function toReportExport(row: ReportExportMetaRow): ReportExport {
  return {
    id: row.id,
    eventId: row.eventId,
    kind: row.kind,
    format: row.format,
    status: row.status,
    fileName: row.fileName,
    contentType: row.contentType,
    rowCount: row.rowCount,
    byteSize: row.byteSize,
    truncated: row.truncated,
    error: row.error,
    createdAt: row.createdAt.toISOString(),
    startedAt: row.startedAt ? row.startedAt.toISOString() : null,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
  };
}
