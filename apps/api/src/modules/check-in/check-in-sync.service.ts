import { Injectable } from '@nestjs/common';
import type {
  SyncCheckInsRequest,
  SyncCheckInsResponse,
  SyncScan,
  SyncScanResult,
} from '@event-platform/shared';
import { AppException } from '../../common/app-exception';
import { AUDIT_ACTIONS } from '../../common/audit/audit.actions';
import { AuditService } from '../../common/audit/audit.service';
import { TenantTransactionService } from '../../database/tenant-transaction.service';
import { BadgeVerificationService } from '../badges/badge-verification.service';
import { ModuleRegistryService } from '../module-registry/module-registry.service';
import { assertBadgeUsable, assertEventOperational } from './check-in.rules';
import {
  assertOfflineAllowed,
  maxClockSkewMinutes,
  normaliseScannedAt,
  sortScansByScannedAt,
} from './check-in.sync.rules';
import { CheckInsRepository } from './check-ins.repository';

const CHECK_IN_MODULE = 'checkin';

/** Errors a single scan may report without failing the rest of the batch. */
const REJECTION_CODES = new Set(['not_found', 'badge_revoked']);

/**
 * Offline queue replay (WP-16).
 *
 * Each scan is processed in its own transaction, so an accepted scan is committed even
 * when a later one is rejected or fails. `(event, scan_id)` makes a replay idempotent;
 * `(event, registration)` keeps one attendance row per person.
 */
@Injectable()
export class CheckInSyncService {
  constructor(
    private readonly tenantTransaction: TenantTransactionService,
    private readonly repository: CheckInsRepository,
    private readonly modules: ModuleRegistryService,
    private readonly badges: BadgeVerificationService,
    private readonly audit: AuditService,
  ) {}

  async sync(
    eventId: string,
    input: SyncCheckInsRequest,
  ): Promise<SyncCheckInsResponse> {
    const settings = await this.requireSyncable(eventId);
    assertOfflineAllowed(settings);

    const results: SyncScanResult[] = [];

    for (const scan of sortScansByScannedAt(input.scans)) {
      results.push(await this.syncOne(eventId, input.deviceId ?? null, scan, settings));
    }

    return { results, counts: countResults(results) };
  }

  /** Request-level gates: an event or module that cannot accept any scan fails once. */
  private async requireSyncable(eventId: string): Promise<Record<string, unknown>> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const event = await this.repository.findEventStatus(
        tx,
        tenant.organizationId,
        eventId,
      );

      if (!event) {
        throw AppException.notFound('not_found', 'Event not found.');
      }

      assertEventOperational(event.status);

      await this.modules.requireEnabled(
        tx,
        tenant.organizationId,
        eventId,
        CHECK_IN_MODULE,
      );

      return this.modules.requireEnabledSettings(
        tx,
        tenant.organizationId,
        eventId,
        CHECK_IN_MODULE,
      );
    });
  }

  private async syncOne(
    eventId: string,
    deviceId: string | null,
    scan: SyncScan,
    settings: Record<string, unknown>,
  ): Promise<SyncScanResult> {
    try {
      const outcome = await this.tenantTransaction.withTenant(
        async (tx, tenant) => {
          // A device scan id is the per-scan idempotency key. Check it before the
          // badge, so a replay reports the stored scan even if the token changed.
          const replayed = await this.repository.findByScanId(
            tx,
            tenant.organizationId,
            eventId,
            scan.scanId,
          );

          if (replayed) {
            return { row: replayed, created: false };
          }

          const badge = await this.badges.verifyForEventInTransaction(
            tx,
            tenant.organizationId,
            eventId,
            scan.badgeToken,
          );

          if (!badge) {
            throw AppException.notFound('not_found', 'Badge not found.');
          }

          assertBadgeUsable(badge.status);

          const registration = await this.repository.findRegistration(
            tx,
            tenant.organizationId,
            eventId,
            badge.registrationId,
          );

          if (!registration) {
            throw AppException.notFound('not_found', 'Registration not found.');
          }

          const existing = await this.repository.findByRegistration(
            tx,
            tenant.organizationId,
            eventId,
            badge.registrationId,
          );

          if (existing) {
            return { row: existing, created: false };
          }

          const receivedAt = new Date();
          const scannedAt = normaliseScannedAt(
            scan.scannedAt,
            receivedAt,
            maxClockSkewMinutes(settings),
          );

          return this.repository.createOrReturnExisting(tx, {
            organizationId: tenant.organizationId,
            eventId,
            registrationId: badge.registrationId,
            source: 'OFFLINE',
            scanId: scan.scanId,
            scannedAt,
            receivedAt,
            checkedInByUserId: tenant.userId,
            deviceId,
          });
        },
      );

      if (outcome.created) {
        await this.recordAudit(eventId, scan, outcome.row.id, outcome.row.registrationId);
      }

      return outcome.created
        ? {
            scanId: scan.scanId,
            status: 'created',
            checkInId: outcome.row.id,
            participant: participantOf(outcome.row),
          }
        : {
            scanId: scan.scanId,
            status: 'duplicate',
            checkInId: outcome.row.id,
            participant: participantOf(outcome.row),
          };
    } catch (error) {
      if (
        error instanceof AppException &&
        REJECTION_CODES.has(error.code)
      ) {
        return { scanId: scan.scanId, status: 'rejected', code: error.code };
      }

      throw error;
    }
  }

  private async recordAudit(
    eventId: string,
    scan: SyncScan,
    checkInId: string,
    registrationId: string,
  ): Promise<void> {
    await this.audit.record({
      action: AUDIT_ACTIONS.checkInRecorded,
      targetType: 'check_in',
      targetId: checkInId,
      metadata: {
        eventId,
        registrationId,
        source: 'OFFLINE',
        scanId: scan.scanId,
      },
    });
  }
}

function participantOf(row: {
  registration: {
    person: { firstName: string; lastName: string };
    category: { name: string } | null;
  };
}): { displayName: string; category: string | null } {
  return {
    displayName:
      `${row.registration.person.firstName} ${row.registration.person.lastName}`.trim(),
    category: row.registration.category ? row.registration.category.name : null,
  };
}

function countResults(
  results: SyncScanResult[],
): SyncCheckInsResponse['counts'] {
  return results.reduce(
    (counts, result) => {
      counts[result.status] += 1;
      return counts;
    },
    { created: 0, duplicate: 0, rejected: 0 },
  );
}
