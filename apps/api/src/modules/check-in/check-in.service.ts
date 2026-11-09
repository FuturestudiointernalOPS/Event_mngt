import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import type {
  CheckInManifestEntry,
  CheckInStats,
  ScanRequest,
  ScanResult,
} from '@event-platform/shared';
import { writeAudit } from '../../common/audit/audit';
import { AppException } from '../../common/app-exception';
import { signBadge, verifyBadge } from '../../common/utils/badge';
import { resolveBadgeSecret } from '../../common/utils/badge-secret';
import { requireModule } from '../../common/utils/event-modules';
import type { Env } from '../../config/env.validation';
import { TenantTransactionService } from '../../database/tenant-transaction.service';
import type { TenantPrismaClient } from '../../database/tenant-transaction.service';

const PERSON = { select: { firstName: true, lastName: true } } as const;

export function hashBadgeCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

/**
 * Attendance. One check-in per registration per event, enforced by a unique constraint:
 * a repeated scan, a re-sent offline scan or two devices racing each other all resolve to
 * the same single attendance record and are reported as duplicates, never double counted.
 */
@Injectable()
export class CheckInService {
  constructor(
    private readonly tenantTransaction: TenantTransactionService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Minimum data a device needs to validate scans offline: hashes, never the signing key. */
  manifest(eventId: string): Promise<CheckInManifestEntry[]> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      await requireModule(tx, eventId, 'checkin');
      const secret = this.secret();
      const rows = await tx.registration.findMany({
        where: { organizationId: tenant.organizationId, eventId, status: 'CONFIRMED' },
        select: { id: true, person: PERSON, category: { select: { name: true } }, _count: { select: { checkIns: true } } },
        orderBy: { createdAt: 'asc' },
      });
      return rows.map((r) => ({
        registrationId: r.id,
        codeHash: hashBadgeCode(signBadge(secret, tenant.organizationId, r.id)),
        name: `${r.person.firstName} ${r.person.lastName}`,
        categoryName: r.category.name,
        checkedIn: r._count.checkIns > 0,
      }));
    });
  }

  scan(eventId: string, input: ScanRequest): Promise<ScanResult> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const settings = await requireModule(tx, eventId, 'checkin');
      this.assertSourceAllowed(input, settings);
      return this.process(tx, tenant.organizationId, tenant.userId, eventId, input);
    });
  }

  /** Each scan is processed in its own transaction so one bad scan cannot sink the batch. */
  async sync(eventId: string, scans: ScanRequest[]): Promise<ScanResult[]> {
    const results: ScanResult[] = [];
    for (const scan of scans) {
      try {
        results.push(await this.scan(eventId, { ...scan, source: scan.source === 'ONLINE' ? 'OFFLINE' : scan.source }));
      } catch (error) {
        if (error instanceof AppException && error.code === 'module_disabled') {
          throw error;
        }
        results.push({ result: 'invalid', clientScanId: scan.clientScanId ?? null, participant: null, checkedInAt: null });
      }
    }
    return results;
  }

  stats(eventId: string): Promise<CheckInStats> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const rows = await tx.registration.findMany({
        where: { organizationId: tenant.organizationId, eventId, status: 'CONFIRMED' },
        select: { category: { select: { name: true } }, _count: { select: { checkIns: true } } },
      });
      const byCategory = new Map<string, { confirmed: number; checkedIn: number }>();
      for (const row of rows) {
        const entry = byCategory.get(row.category.name) ?? { confirmed: 0, checkedIn: 0 };
        entry.confirmed += 1;
        entry.checkedIn += row._count.checkIns > 0 ? 1 : 0;
        byCategory.set(row.category.name, entry);
      }
      return {
        confirmed: rows.length,
        checkedIn: rows.filter((r) => r._count.checkIns > 0).length,
        byCategory: [...byCategory].map(([categoryName, v]) => ({ categoryName, ...v })),
      };
    });
  }

  /** Manual fallback: find a confirmed participant by name or e-mail. */
  lookup(eventId: string, q: string): Promise<{ registrationId: string; name: string; email: string; categoryName: string; checkedIn: boolean }[]> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const rows = await tx.registration.findMany({
        where: {
          organizationId: tenant.organizationId,
          eventId,
          status: 'CONFIRMED',
          person: {
            OR: [
              { email: { contains: q, mode: 'insensitive' } },
              { firstName: { contains: q, mode: 'insensitive' } },
              { lastName: { contains: q, mode: 'insensitive' } },
            ],
          },
        },
        take: 20,
        select: { id: true, person: { select: { firstName: true, lastName: true, email: true } }, category: { select: { name: true } }, _count: { select: { checkIns: true } } },
      });
      return rows.map((r) => ({
        registrationId: r.id,
        name: `${r.person.firstName} ${r.person.lastName}`,
        email: r.person.email,
        categoryName: r.category.name,
        checkedIn: r._count.checkIns > 0,
      }));
    });
  }

  private async process(
    tx: TenantPrismaClient,
    organizationId: string,
    userId: string,
    eventId: string,
    input: ScanRequest,
  ): Promise<ScanResult> {
    const clientScanId = input.clientScanId ?? null;
    const invalid: ScanResult = { result: 'invalid', clientScanId, participant: null, checkedInAt: null };

    // A re-sent scan (same device id) is a replay of an earlier result, not a duplicate scan.
    if (clientScanId) {
      const replay = await tx.checkIn.findFirst({ where: { eventId, clientScanId, organizationId } });
      if (replay) {
        return this.report('checked_in', replay.registrationId, replay.scannedAt, clientScanId, tx, organizationId);
      }
    }

    const registrationId = input.code
      ? verifyBadge(this.secret(), organizationId, input.code)?.registrationId
      : input.registrationId;

    if (!registrationId) {
      return invalid;
    }

    const registration = await tx.registration.findFirst({
      where: { id: registrationId, eventId, organizationId },
      select: { id: true, status: true },
    });
    if (!registration) {
      return invalid;
    }
    if (registration.status !== 'CONFIRMED') {
      return this.report('not_confirmed', registration.id, null, clientScanId, tx, organizationId);
    }

    const existing = await tx.checkIn.findUnique({ where: { eventId_registrationId: { eventId, registrationId } } });
    if (existing) {
      return this.report('duplicate', registrationId, existing.scannedAt, clientScanId, tx, organizationId);
    }

    const scannedAt = input.scannedAt ? new Date(input.scannedAt) : new Date();

    // ON CONFLICT DO NOTHING: if another device recorded this registration an instant ago,
    // nothing is inserted (and the transaction stays usable) and we report a duplicate.
    const inserted = await tx.checkIn.createMany({
      data: [
        {
          organizationId,
          eventId,
          registrationId,
          scannedAt,
          source: input.source,
          clientScanId,
          scannedByUserId: userId,
        },
      ],
      skipDuplicates: true,
    });

    if (inserted.count === 0) {
      const winner = await tx.checkIn.findUnique({ where: { eventId_registrationId: { eventId, registrationId } } });
      return this.report('duplicate', registrationId, winner?.scannedAt ?? null, clientScanId, tx, organizationId);
    }

    await writeAudit(tx, {
      organizationId,
      actorUserId: userId,
      action: 'checkin.recorded',
      targetType: 'registration',
      targetId: registrationId,
      metadata: { source: input.source },
    });

    return this.report('checked_in', registrationId, scannedAt, clientScanId, tx, organizationId);
  }

  private async report(
    result: ScanResult['result'],
    registrationId: string,
    at: Date | null,
    clientScanId: string | null,
    tx: TenantPrismaClient,
    organizationId: string,
  ): Promise<ScanResult> {
    const row = await tx.registration.findFirst({
      where: { id: registrationId, organizationId },
      select: { person: PERSON, category: { select: { name: true } } },
    });
    return {
      result,
      clientScanId,
      participant: row
        ? { registrationId, name: `${row.person.firstName} ${row.person.lastName}`, categoryName: row.category.name }
        : null,
      checkedInAt: at ? at.toISOString() : null,
    };
  }

  private assertSourceAllowed(input: ScanRequest, settings: Record<string, unknown>): void {
    if (input.source === 'OFFLINE' && settings.allowOffline === false) {
      throw AppException.unprocessable('offline_disabled', 'Offline check-in is disabled for this event.');
    }
    if (!input.code && !input.registrationId) {
      throw AppException.badRequest('invalid_scan', 'Provide a badge code or a registration.');
    }
  }

  private secret(): string {
    return resolveBadgeSecret(
      this.config.get('BADGE_SIGNING_SECRET', { infer: true }),
      this.config.get('JWT_ACCESS_SECRET', { infer: true }),
    );
  }
}
