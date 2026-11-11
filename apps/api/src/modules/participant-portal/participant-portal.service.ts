import { Injectable } from '@nestjs/common';
import {
  badgeQrPayload,
  type ParticipantDataExport,
  type ParticipantOverview,
} from '@event-platform/shared';
import { AUDIT_ACTIONS } from '../../common/audit/audit.actions';
import { AuditService } from '../../common/audit/audit.service';
import { AppException } from '../../common/app-exception';
import type { ParticipantAccess } from '../../common/types/authenticated-user';
import { TenantTransactionService } from '../../database/tenant-transaction.service';
import { RegistrationsService } from '../registrations/registrations.service';
import { assertCanWithdraw } from './participant-portal.rules';

/**
 * The registrant's own space. Every query is bound to the single registration the
 * credential proved, plus the organisation predicate; there is no way to name another one.
 */
@Injectable()
export class ParticipantPortalService {
  constructor(
    private readonly tenantTransaction: TenantTransactionService,
    private readonly registrations: RegistrationsService,
    private readonly audit: AuditService,
  ) {}

  overview(participant: ParticipantAccess): Promise<ParticipantOverview> {
    return this.tenantTransaction.withTenant(async (tx) => {
      const row = await tx.registration.findFirst({
        where: { id: participant.registrationId, organizationId: participant.organizationId },
        select: {
          reference: true,
          person: { select: { firstName: true, lastName: true } },
          category: { select: { key: true, name: true } },
          checkIns: { select: { id: true }, take: 1 },
          event: {
            select: {
              name: true,
              slug: true,
              startsAt: true,
              endsAt: true,
              timeZone: true,
              venueName: true,
              venueAddress: true,
              modules: { where: { enabled: true }, select: { moduleKey: true } },
            },
          },
        },
      });

      if (!row) {
        throw AppException.notFound('not_found', 'Registration not found.');
      }

      return {
        reference: row.reference,
        status: 'APPROVED',
        person: row.person,
        category: row.category,
        event: {
          name: row.event.name,
          slug: row.event.slug,
          startsAt: row.event.startsAt.toISOString(),
          endsAt: row.event.endsAt.toISOString(),
          timeZone: row.event.timeZone,
          venueName: row.event.venueName,
          venueAddress: row.event.venueAddress,
        },
        badge: { reference: participant.badgeReference, qrPayload: badgeQrPayload(participant.badgeToken) },
        checkedIn: row.checkIns.length > 0,
        modules: row.event.modules.map((module) => module.moduleKey),
      };
    });
  }

  /** Withdraws the registration and revokes the badge, which ends this link's access. */
  async withdraw(participant: ParticipantAccess): Promise<void> {
    await this.tenantTransaction.withTenant(async (tx) => {
      const row = await tx.registration.findFirst({
        where: { id: participant.registrationId, organizationId: participant.organizationId },
        select: { status: true, checkIns: { select: { id: true }, take: 1 } },
      });

      if (!row) {
        throw AppException.notFound('not_found', 'Registration not found.');
      }

      assertCanWithdraw({ status: row.status, checkedIn: row.checkIns.length > 0 });

      await tx.registration.update({
        where: { id: participant.registrationId },
        data: { status: 'CANCELLED', decidedAt: new Date(), decisionReason: 'Withdrawn by the participant' },
      });
      await tx.badge.updateMany({
        where: { registrationId: participant.registrationId, organizationId: participant.organizationId },
        data: { status: 'REVOKED', revokedAt: new Date() },
      });
    });

    await this.audit.record({
      action: AUDIT_ACTIONS.registrationCancelledByParticipant,
      targetType: 'registration',
      targetId: participant.registrationId,
    });
  }

  /** The registrant's own data, as they would receive it on request. */
  async exportData(participant: ParticipantAccess): Promise<ParticipantDataExport> {
    const data = await this.tenantTransaction.withTenant(async (tx) => {
      const row = await tx.registration.findFirst({
        where: { id: participant.registrationId, organizationId: participant.organizationId },
        select: {
          reference: true,
          status: true,
          submittedAt: true,
          person: true,
          category: { select: { name: true } },
          answers: { select: { fieldKey: true, value: true } },
          consents: { select: { documentKey: true, documentVersion: true, acceptedAt: true } },
          profile: { select: { headline: true, bio: true, company: true, jobTitle: true } },
          checkIns: { select: { scannedAt: true }, take: 1 },
        },
      });

      if (!row) {
        throw AppException.notFound('not_found', 'Registration not found.');
      }

      return row;
    });

    await this.audit.record({
      action: AUDIT_ACTIONS.participantDataExported,
      targetType: 'registration',
      targetId: participant.registrationId,
    });

    return {
      exportedAt: new Date().toISOString(),
      person: {
        firstName: data.person.firstName,
        lastName: data.person.lastName,
        email: data.person.email,
        phone: data.person.phone,
        organizationName: data.person.organizationName,
        jobTitle: data.person.jobTitle,
        country: data.person.country,
      },
      registration: {
        reference: data.reference,
        status: data.status,
        submittedAt: data.submittedAt.toISOString(),
        category: data.category?.name ?? null,
      },
      answers: data.answers.map((answer) => ({ fieldKey: answer.fieldKey, value: answer.value })),
      consents: data.consents.map((consent) => ({
        key: consent.documentKey,
        version: consent.documentVersion,
        acceptedAt: consent.acceptedAt.toISOString(),
      })),
      profile: data.profile,
      checkedInAt: data.checkIns[0]?.scannedAt.toISOString() ?? null,
    };
  }

  /** Erases the person across the organisation; the registration rows stay for the counts. */
  erase(participant: ParticipantAccess): Promise<void> {
    return this.registrations.erase(participant.eventId, participant.registrationId);
  }
}
