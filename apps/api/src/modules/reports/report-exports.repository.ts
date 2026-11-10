import { Injectable } from '@nestjs/common';
import type { TenantPrismaClient } from '../../database/tenant-transaction.service';
import {
  ExportFormat,
  ExportKind,
  ExportStatus,
  Prisma,
} from '../../database/prisma-client';
import type { ExportRegistrationRow } from './report-files';

const EXPORT_META_SELECT = {
  id: true,
  organizationId: true,
  eventId: true,
  requestedByUserId: true,
  kind: true,
  format: true,
  status: true,
  fileName: true,
  contentType: true,
  rowCount: true,
  byteSize: true,
  truncated: true,
  error: true,
  createdAt: true,
  startedAt: true,
  completedAt: true,
  expiresAt: true,
} as const satisfies Prisma.ReportExportSelect;

export type ReportExportMetaRow = Prisma.ReportExportGetPayload<{
  select: typeof EXPORT_META_SELECT;
}>;

export interface ExportDownloadRow {
  fileName: string;
  contentType: string;
  status: ExportStatus;
  expiresAt: Date | null;
  content: Uint8Array | null;
}

export interface CreateReportExportData {
  organizationId: string;
  eventId: string;
  requestedByUserId: string;
  kind: ExportKind;
  format: ExportFormat;
  fileName: string;
  contentType: string;
  expiresAt: Date;
}

export interface CompleteReportExportData {
  content: Buffer;
  rowCount: number;
  byteSize: number;
  truncated: boolean;
  completedAt: Date;
}

/**
 * Export rows and the registration data they snapshot. Every statement carries the
 * organisation predicate; an export from another tenant is simply absent (R7).
 */
@Injectable()
export class ReportExportsRepository {
  findEvent(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
  ): Promise<{ id: string; name: string; slug: string } | null> {
    return tx.event.findFirst({
      where: { id: eventId, organizationId },
      select: { id: true, name: true, slug: true },
    });
  }

  create(
    tx: TenantPrismaClient,
    data: CreateReportExportData,
  ): Promise<ReportExportMetaRow> {
    return tx.reportExport.create({ data, select: EXPORT_META_SELECT });
  }

  list(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
    status: ExportStatus | undefined,
    skip: number,
    take: number,
  ): Promise<[ReportExportMetaRow[], number]> {
    const where = { organizationId, eventId, status };

    return Promise.all([
      tx.reportExport.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        select: EXPORT_META_SELECT,
      }),
      tx.reportExport.count({ where }),
    ]);
  }

  find(
    tx: TenantPrismaClient,
    organizationId: string,
    exportId: string,
  ): Promise<ReportExportMetaRow | null> {
    return tx.reportExport.findFirst({
      where: { id: exportId, organizationId },
      select: EXPORT_META_SELECT,
    });
  }

  findDownload(
    tx: TenantPrismaClient,
    organizationId: string,
    exportId: string,
  ): Promise<ExportDownloadRow | null> {
    return tx.reportExport.findFirst({
      where: { id: exportId, organizationId },
      select: {
        fileName: true,
        contentType: true,
        status: true,
        expiresAt: true,
        content: true,
      },
    });
  }

  /**
   * Atomically move PENDING to PROCESSING. The conditional update is the claim: two
   * workers racing on the same row produce one winner and one no-op.
   */
  async claim(
    tx: TenantPrismaClient,
    organizationId: string,
    exportId: string,
  ): Promise<ReportExportMetaRow | null> {
    const claimed = await tx.reportExport.updateMany({
      where: { id: exportId, organizationId, status: 'PENDING' },
      data: { status: 'PROCESSING', startedAt: new Date(), error: null },
    });

    if (claimed.count === 0) {
      return null;
    }

    return this.find(tx, organizationId, exportId);
  }

  complete(
    tx: TenantPrismaClient,
    organizationId: string,
    exportId: string,
    data: CompleteReportExportData,
  ): Promise<ReportExportMetaRow> {
    return tx.reportExport.update({
      where: { id: exportId, organizationId },
      data: {
        status: 'COMPLETED',
        content: new Uint8Array(data.content),
        rowCount: data.rowCount,
        byteSize: data.byteSize,
        truncated: data.truncated,
        completedAt: data.completedAt,
        error: null,
      },
      select: EXPORT_META_SELECT,
    });
  }

  /**
   * Marks a row failed only while it is unclaimed or being processed. A late failure
   * from a worker whose transaction rolled back must not overwrite a row another worker
   * already completed.
   */
  async fail(
    tx: TenantPrismaClient,
    organizationId: string,
    exportId: string,
    error: string,
  ): Promise<void> {
    await tx.reportExport.updateMany({
      where: {
        id: exportId,
        organizationId,
        status: { in: ['PENDING', 'PROCESSING'] },
      },
      data: { status: 'FAILED', error, completedAt: new Date() },
    });
  }

  /**
   * Registration rows in submission order. `take + 1` is fetched by the caller to
   * detect truncation without a second count query.
   */
  registrationRows(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
    take: number,
  ): Promise<ExportRegistrationRow[]> {
    return tx.registration
      .findMany({
        where: { organizationId, eventId },
        orderBy: [{ submittedAt: 'asc' }, { id: 'asc' }],
        take,
        select: {
          reference: true,
          status: true,
          source: true,
          submittedAt: true,
          decidedAt: true,
          person: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              organizationName: true,
              jobTitle: true,
              country: true,
            },
          },
          category: { select: { key: true, name: true } },
        },
      })
      .then((rows) =>
        rows.map((row) => ({
          reference: row.reference,
          status: row.status,
          source: row.source,
          submittedAt: row.submittedAt,
          decidedAt: row.decidedAt,
          firstName: row.person.firstName,
          lastName: row.person.lastName,
          email: row.person.email,
          phone: row.person.phone,
          organizationName: row.person.organizationName,
          jobTitle: row.person.jobTitle,
          country: row.person.country,
          categoryKey: row.category?.key ?? null,
          categoryName: row.category?.name ?? null,
        })),
      );
  }
}
