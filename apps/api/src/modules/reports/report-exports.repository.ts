import { Injectable } from '@nestjs/common';
import type { TenantPrismaClient } from '../../database/tenant-transaction.service';
import {
  ExportFormat,
  ExportKind,
  ExportStatus,
  Prisma,
} from '../../database/prisma-client';

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
   *
   * `reclaim` is for a queue redelivery: a worker that died mid-job leaves the row in
   * PROCESSING, and the retry must be able to take it back.
   */
  async claim(
    tx: TenantPrismaClient,
    organizationId: string,
    exportId: string,
    reclaim = false,
  ): Promise<ReportExportMetaRow | null> {
    const claimed = await tx.reportExport.updateMany({
      where: {
        id: exportId,
        organizationId,
        status: reclaim ? { in: ['PENDING', 'PROCESSING'] } : 'PENDING',
      },
      data: { status: 'PROCESSING', startedAt: new Date(), error: null },
    });

    if (claimed.count === 0) {
      return null;
    }

    return this.find(tx, organizationId, exportId);
  }

  /** Puts a claim back so the next queue attempt can pick it up. */
  async release(
    tx: TenantPrismaClient,
    organizationId: string,
    exportId: string,
  ): Promise<void> {
    await tx.reportExport.updateMany({
      where: { id: exportId, organizationId, status: 'PROCESSING' },
      data: { status: 'PENDING', startedAt: null },
    });
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
}
