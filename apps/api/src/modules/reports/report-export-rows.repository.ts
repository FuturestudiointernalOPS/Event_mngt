import { Injectable } from '@nestjs/common';
import type { TenantPrismaClient } from '../../database/tenant-transaction.service';
import type { ExportRegistrationRow } from './report-files';

/**
 * The participant rows an export snapshots. Kept apart from the export lifecycle queries
 * because this projection is large and changes for reporting reasons, not job reasons.
 */
@Injectable()
export class ReportExportRowsRepository {
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
