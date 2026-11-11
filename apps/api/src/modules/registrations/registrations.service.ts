import { Injectable } from '@nestjs/common';
import type {
  DecideRegistrationRequest,
  ListRegistrationsQuery,
  RegistrationDetail,
  RegistrationSummary,
} from '@event-platform/shared';
import { AppException } from '../../common/app-exception';
import { AUDIT_ACTIONS } from '../../common/audit/audit.actions';
import { AuditService } from '../../common/audit/audit.service';
import type { PaginatedResult } from '../../common/types/authenticated-user';
import { TenantTransactionService } from '../../database/tenant-transaction.service';
import { RegistrationStatus } from '../../database/prisma-client';
import { BadgesService, type IssuedBadgeNotice } from '../badges/badges.service';
import { toDetail, toSummary } from './registrations.mapper';
import { buildListWhere, REGISTRATION_ORDER } from './registrations.query';
import { RegistrationsErasureRepository } from './registrations-erasure.repository';
import { RegistrationsRepository } from './registrations.repository';
import { assertDecidable, type Decision } from './registrations.rules';

interface DecisionOutcome {
  detail: RegistrationDetail;
  notice: IssuedBadgeNotice | null;
}

/**
 * Staff registration surface and the approval workflow (WP-10, WP-12).
 *
 * A decision and the badge it produces commit together; the email is sent after the
 * transaction, so a provider outage cannot undo an approval.
 */
@Injectable()
export class RegistrationsService {
  constructor(
    private readonly tenantTransaction: TenantTransactionService,
    private readonly repository: RegistrationsRepository,
    private readonly erasure: RegistrationsErasureRepository,
    private readonly badges: BadgesService,
    private readonly audit: AuditService,
  ) {}

  list(
    eventId: string,
    query: ListRegistrationsQuery,
  ): Promise<PaginatedResult<RegistrationSummary>> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const [rows, total] = await this.repository.list(
        tx,
        buildListWhere(query, tenant.organizationId, eventId),
        REGISTRATION_ORDER,
        (query.page - 1) * query.pageSize,
        query.pageSize,
      );

      return {
        items: rows.map(toSummary),
        page: query.page,
        pageSize: query.pageSize,
        total,
      };
    });
  }

  detail(eventId: string, registrationId: string): Promise<RegistrationDetail> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const row = await this.repository.findDetail(
        tx,
        tenant.organizationId,
        eventId,
        registrationId,
      );

      if (!row) {
        throw AppException.notFound('not_found', 'Registration not found.');
      }

      return toDetail(row);
    });
  }

  approve(
    eventId: string,
    registrationId: string,
    input: DecideRegistrationRequest,
  ): Promise<RegistrationDetail> {
    return this.decide(eventId, registrationId, RegistrationStatus.APPROVED, input);
  }

  reject(
    eventId: string,
    registrationId: string,
    input: DecideRegistrationRequest,
  ): Promise<RegistrationDetail> {
    return this.decide(eventId, registrationId, RegistrationStatus.REJECTED, input);
  }

  private async decide(
    eventId: string,
    registrationId: string,
    decision: Decision,
    input: DecideRegistrationRequest,
  ): Promise<RegistrationDetail> {
    const outcome = await this.tenantTransaction.withTenant(
      async (tx, tenant): Promise<DecisionOutcome> => {
        const existing = await this.repository.findStatus(
          tx,
          tenant.organizationId,
          eventId,
          registrationId,
        );

        if (!existing) {
          throw AppException.notFound('not_found', 'Registration not found.');
        }

        assertDecidable(existing.status, decision);

        const updated = await this.repository.decide(
          tx,
          tenant.organizationId,
          eventId,
          registrationId,
          {
            status: decision,
            decidedAt: new Date(),
            decidedByUserId: tenant.userId,
            decisionReason: input.reason ?? null,
          },
        );

        const notice =
          decision === RegistrationStatus.APPROVED
            ? await this.badges.issueForApproved(
                tx,
                tenant.organizationId,
                eventId,
                registrationId,
              )
            : null;

        // The badge is created after the status update, so the row read before issuance
        // still reports `badge: null`. Re-read the detail so the response tells the truth.
        const detailRow =
          notice === null
            ? updated
            : ((await this.repository.findDetail(
                tx,
                tenant.organizationId,
                eventId,
                registrationId,
              )) ?? updated);

        return { detail: toDetail(detailRow), notice };
      },
    );

    if (outcome.notice) {
      await this.badges.notifyIssued(outcome.notice);
    }

    await this.audit.record({
      action:
        decision === RegistrationStatus.APPROVED
          ? AUDIT_ACTIONS.registrationApproved
          : AUDIT_ACTIONS.registrationRejected,
      targetType: 'registration',
      targetId: registrationId,
    });

    return outcome.detail;
  }

  /**
   * Erases a person on request, for every registration they hold in this organisation.
   *
   * The registration rows survive so the event's counts stay honest, but nothing in them
   * still points at the person. The audit entry records that an erasure happened, never
   * what was erased.
   */
  async erase(eventId: string, registrationId: string): Promise<void> {
    const personId = await this.tenantTransaction.withTenant(async (tx, tenant) => {
      const row = await this.repository.findDetail(
        tx,
        tenant.organizationId,
        eventId,
        registrationId,
      );

      if (!row) {
        throw AppException.notFound('not_found', 'Registration not found.');
      }

      await this.erasure.erasePersonData(tx, tenant.organizationId, row.person.id);

      return row.person.id;
    });

    await this.audit.record({
      action: AUDIT_ACTIONS.personErased,
      targetType: 'person',
      targetId: personId,
    });
  }
}
