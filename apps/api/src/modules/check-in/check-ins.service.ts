import { Injectable, Logger } from '@nestjs/common';
import type {
  CheckIn,
  CheckInSummary,
  CreateCheckInRequest,
  ListCheckInsQuery,
} from '@event-platform/shared';
import { AppException } from '../../common/app-exception';
import { AUDIT_ACTIONS } from '../../common/audit/audit.actions';
import { AuditService } from '../../common/audit/audit.service';
import type { PaginatedResult } from '../../common/types/authenticated-user';
import {
  TenantTransactionService,
  type TenantPrismaClient,
} from '../../database/tenant-transaction.service';
import type { EventStatus } from '../../database/prisma-client';
import { BadgeVerificationService } from '../badges/badge-verification.service';
import { ModuleRegistryService } from '../module-registry/module-registry.service';
import {
  assertBadgeUsable,
  assertEventOperational,
  classifyRepeat,
  duplicateWindowMinutes,
} from './check-in.rules';
import { toCheckIn } from './check-ins.mapper';
import { CheckInsRepository } from './check-ins.repository';

const CHECK_IN_MODULE = 'checkin';

/**
 * Attendance recording and reads (WP-15).
 *
 * One transaction covers the module gate, badge verification and the attendance write,
 * so a scan cannot be accepted against a badge that was revoked a moment earlier. The
 * audit entry is written after the commit: a failed audit never undoes attendance.
 */
@Injectable()
export class CheckInsService {
  private readonly logger = new Logger(CheckInsService.name);

  constructor(
    private readonly tenantTransaction: TenantTransactionService,
    private readonly repository: CheckInsRepository,
    private readonly modules: ModuleRegistryService,
    private readonly badges: BadgeVerificationService,
    private readonly audit: AuditService,
  ) {}

  async record(eventId: string, input: CreateCheckInRequest): Promise<CheckIn> {
    const outcome = await this.tenantTransaction.withTenant(
      async (tx, tenant) => {
        const event = await this.requireEvent(tx, tenant.organizationId, eventId);
        assertEventOperational(event.status);

        await this.modules.requireEnabled(
          tx,
          tenant.organizationId,
          eventId,
          CHECK_IN_MODULE,
        );
        const settings = await this.modules.requireEnabledSettings(
          tx,
          tenant.organizationId,
          eventId,
          CHECK_IN_MODULE,
        );

        const badge = await this.badges.verifyForEventInTransaction(
          tx,
          tenant.organizationId,
          eventId,
          input.badgeToken,
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

        const scannedAt = new Date(input.scannedAt);
        const existing = input.scanId
          ? await this.repository.findByScanId(
              tx,
              tenant.organizationId,
              eventId,
              input.scanId,
            )
          : null;
        const attendance =
          existing ??
          (await this.repository.findByRegistration(
            tx,
            tenant.organizationId,
            eventId,
            badge.registrationId,
          ));

        if (attendance) {
          this.describeRepeat(
            attendance.scannedAt,
            scannedAt,
            duplicateWindowMinutes(settings),
          );

          return { checkIn: toCheckIn(attendance, true), created: false };
        }

        const { row, created } = await this.repository.createOrReturnExisting(
          tx,
          {
            organizationId: tenant.organizationId,
            eventId,
            registrationId: badge.registrationId,
            source: 'ONLINE',
            scanId: input.scanId ?? null,
            scannedAt,
            receivedAt: new Date(),
            checkedInByUserId: tenant.userId,
            deviceId: null,
          },
        );

        return { checkIn: toCheckIn(row, !created), created };
      },
    );

    if (outcome.created) {
      await this.audit.record({
        action: AUDIT_ACTIONS.checkInRecorded,
        targetType: 'check_in',
        targetId: outcome.checkIn.id,
        metadata: {
          eventId,
          registrationId: outcome.checkIn.registrationId,
          source: outcome.checkIn.source,
        },
      });
    }

    return outcome.checkIn;
  }

  list(
    eventId: string,
    query: ListCheckInsQuery,
  ): Promise<PaginatedResult<CheckIn>> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      await this.assertEnabled(tx, tenant.organizationId, eventId);

      const [rows, total] = await this.repository.list(
        tx,
        tenant.organizationId,
        eventId,
        (query.page - 1) * query.pageSize,
        query.pageSize,
      );

      return {
        items: rows.map((row) => toCheckIn(row, false)),
        page: query.page,
        pageSize: query.pageSize,
        total,
      };
    });
  }

  summary(eventId: string): Promise<CheckInSummary> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      await this.assertEnabled(tx, tenant.organizationId, eventId);

      const total = await this.repository.count(
        tx,
        tenant.organizationId,
        eventId,
      );

      return { total };
    });
  }

  /**
   * The response shape has no room for the label (the contract is frozen), so the
   * classification is logged for whoever is watching the scanners.
   */
  private describeRepeat(
    originalScannedAt: Date,
    scannedAt: Date,
    windowMinutes: number,
  ): void {
    this.logger.debug(
      `Repeat scan classified as ${classifyRepeat(
        originalScannedAt,
        scannedAt,
        windowMinutes,
      )}.`,
    );
  }

  private async assertEnabled(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
  ): Promise<void> {
    await this.requireEvent(tx, organizationId, eventId);

    await this.modules.requireEnabled(
      tx,
      organizationId,
      eventId,
      CHECK_IN_MODULE,
    );
  }

  private async requireEvent(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
  ): Promise<{ id: string; status: EventStatus }> {
    const event = await this.repository.findEventStatus(
      tx,
      organizationId,
      eventId,
    );

    if (!event) {
      throw AppException.notFound('not_found', 'Event not found.');
    }

    return event;
  }
}
