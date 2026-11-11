import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { TenantPrismaClient } from '../../database/tenant-transaction.service';
import type { AuditRow } from './audit.mapper';

/**
 * Reading the trail. Writing is the service's job, and the only operations here are
 * a paginated read and a count: nothing updates or deletes, by design.
 */
@Injectable()
export class AuditRepository {
  constructor(private readonly prisma: PrismaService) {}

  list(
    tx: TenantPrismaClient,
    organizationId: string,
    page: number,
    pageSize: number,
  ): Promise<[AuditRow[], number]> {
    return Promise.all([
      tx.auditLog.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { actor: { select: { id: true, email: true, displayName: true } } },
      }),
      tx.auditLog.count({ where: { organizationId } }),
    ]);
  }
}
