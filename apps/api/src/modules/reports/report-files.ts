import type { ExportFormat } from '@event-platform/shared';
import type { RegistrationSource, RegistrationStatus } from '../../database/prisma-client';
import { renderRegistrationsPdf } from './report-pdf';
import { MAX_EXPORT_ROWS } from './report-exports.rules';

/** One row the export renderers need. PII is deliberate: `report:export` gates it. */
export interface ExportRegistrationRow {
  reference: string;
  status: RegistrationStatus;
  source: RegistrationSource;
  submittedAt: Date;
  decidedAt: Date | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  organizationName: string | null;
  jobTitle: string | null;
  country: string | null;
  categoryKey: string | null;
  categoryName: string | null;
}

export interface ExportTable {
  rows: ExportRegistrationRow[];
  truncated: boolean;
  eventName: string;
  generatedAt: Date;
}

export interface RenderedExport {
  content: Buffer;
  rowCount: number;
  truncated: boolean;
}

/** RFC 4180 escaping: quote when the value contains a delimiter, quote or newline. */
export function csvCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

export const EXPORT_HEADERS = [
  'reference',
  'status',
  'source',
  'submitted_at',
  'decided_at',
  'first_name',
  'last_name',
  'email',
  'phone',
  'organisation',
  'job_title',
  'country',
  'category_key',
  'category_name',
] as const;

function formatDate(value: Date | null): string {
  return value ? value.toISOString() : '';
}

function rowValues(row: ExportRegistrationRow): string[] {
  return [
    row.reference,
    row.status,
    row.source,
    formatDate(row.submittedAt),
    formatDate(row.decidedAt),
    row.firstName,
    row.lastName,
    row.email,
    row.phone ?? '',
    row.organizationName ?? '',
    row.jobTitle ?? '',
    row.country ?? '',
    row.categoryKey ?? '',
    row.categoryName ?? '',
  ];
}

/**
 * UTF-8 with a BOM: spreadsheet tools otherwise read French accents as Latin-1.
 * Line endings are CRLF for the same interoperability reason.
 */
export function renderRegistrationsCsv(table: ExportTable): RenderedExport {
  const lines = [EXPORT_HEADERS.map(csvCell).join(',')];

  for (const row of table.rows) {
    lines.push(rowValues(row).map(csvCell).join(','));
  }

  const content = Buffer.from(`\uFEFF${lines.join('\r\n')}\r\n`, 'utf8');

  return {
    content,
    rowCount: table.rows.length,
    truncated: table.truncated,
  };
}

export function capRows<T>(rows: T[]): { rows: T[]; truncated: boolean } {
  if (rows.length <= MAX_EXPORT_ROWS) {
    return { rows, truncated: false };
  }

  return { rows: rows.slice(0, MAX_EXPORT_ROWS), truncated: true };
}

/** Dispatch point; adding a format means adding a renderer and a contract value. */
export function renderExport(
  format: ExportFormat,
  table: ExportTable,
): RenderedExport {
  switch (format) {
    case 'CSV':
      return renderRegistrationsCsv(table);
    case 'PDF':
      return renderRegistrationsPdf(table);
  }
}
