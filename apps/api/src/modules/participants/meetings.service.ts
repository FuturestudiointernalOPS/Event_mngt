import { Injectable } from '@nestjs/common';
import type {
  MeetingOutcomeRequest,
  MeetingView,
  ProposeMeetingRequest,
  RespondMeetingRequest,
} from '@event-platform/shared';
import { writeAudit } from '../../common/audit/audit';
import { AppException } from '../../common/app-exception';
import { requireModule } from '../../common/utils/event-modules';
import type { ParticipantAccess } from '../../common/types/authenticated-user';
import { TenantTransactionService } from '../../database/tenant-transaction.service';
import { nameOf } from './participant-portal.service';
import {
  assertCanComplete,
  assertCanConfirmMeeting,
  assertCanPropose,
  assertConfirmed,
  resolveMeetingResponse,
} from './participants.rules';

const PEOPLE = { select: { person: { select: { firstName: true, lastName: true } } } } as const;

type Row = {
  id: string;
  proposerRegistrationId: string;
  inviteeRegistrationId: string;
  message: string | null;
  proposedStart: Date | null;
  proposedEnd: Date | null;
  location: string | null;
  status: MeetingView['status'];
  outcome: string | null;
  createdAt: Date;
};

/** Meeting proposals between participants, plus the staff overview and outcomes. */
@Injectable()
export class MeetingsService {
  constructor(private readonly tenantTransaction: TenantTransactionService) {}

  propose(participant: ParticipantAccess, input: ProposeMeetingRequest): Promise<MeetingView> {
    return this.tenantTransaction.withTenant(async (tx) => {
      assertConfirmed(participant.status);
      const settings = await requireModule(tx, participant.eventId, 'meetings');

      const invitee = await tx.registration.findFirst({
        where: {
          id: input.inviteeRegistrationId,
          eventId: participant.eventId,
          organizationId: participant.organizationId,
          status: 'CONFIRMED',
        },
        select: { id: true },
      });
      if (!invitee) {
        throw AppException.notFound('not_found', 'Participant not found.');
      }

      assertCanPropose({
        proposerId: participant.registrationId,
        inviteeId: invitee.id,
        proposalsSoFar: await tx.meeting.count({
          where: { proposerRegistrationId: participant.registrationId, status: { in: ['PROPOSED', 'ACCEPTED'] } },
        }),
        max: typeof settings.maxProposalsPerParticipant === 'number' ? settings.maxProposalsPerParticipant : 10,
      });

      const row = await tx.meeting.create({
        data: {
          organizationId: participant.organizationId,
          eventId: participant.eventId,
          proposerRegistrationId: participant.registrationId,
          inviteeRegistrationId: invitee.id,
          message: input.message ?? null,
          proposedStart: input.proposedStart ? new Date(input.proposedStart) : null,
          proposedEnd: input.proposedEnd ? new Date(input.proposedEnd) : null,
          location: input.location ?? null,
        },
      });

      return (await this.views(tx, participant.organizationId, [row]))[0];
    });
  }

  listMine(participant: ParticipantAccess): Promise<MeetingView[]> {
    return this.tenantTransaction.withTenant(async (tx) => {
      assertConfirmed(participant.status);
      await requireModule(tx, participant.eventId, 'meetings');
      const rows = await tx.meeting.findMany({
        where: {
          organizationId: participant.organizationId,
          OR: [
            { proposerRegistrationId: participant.registrationId },
            { inviteeRegistrationId: participant.registrationId },
          ],
        },
        orderBy: { createdAt: 'desc' },
      });
      return this.views(tx, participant.organizationId, rows);
    });
  }

  respond(participant: ParticipantAccess, meetingId: string, input: RespondMeetingRequest): Promise<MeetingView> {
    return this.tenantTransaction.withTenant(async (tx) => {
      assertConfirmed(participant.status);
      const meeting = await tx.meeting.findFirst({
        where: {
          id: meetingId,
          organizationId: participant.organizationId,
          OR: [
            { proposerRegistrationId: participant.registrationId },
            { inviteeRegistrationId: participant.registrationId },
          ],
        },
      });
      if (!meeting) {
        throw AppException.notFound('not_found', 'Meeting not found.');
      }

      const role = meeting.proposerRegistrationId === participant.registrationId ? 'proposer' : 'invitee';
      const next = resolveMeetingResponse(input.response, meeting.status, role);

      const row = await tx.meeting.update({
        where: { id: meeting.id },
        data: { status: next, respondedAt: new Date() },
      });
      return (await this.views(tx, participant.organizationId, [row]))[0];
    });
  }

  /* ------------------------------------------------------------------- staff */

  listForEvent(eventId: string): Promise<MeetingView[]> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const rows = await tx.meeting.findMany({
        where: { organizationId: tenant.organizationId, eventId },
        orderBy: { createdAt: 'desc' },
        take: 500,
      });
      return this.views(tx, tenant.organizationId, rows);
    });
  }

  confirm(eventId: string, meetingId: string): Promise<MeetingView> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const meeting = await tx.meeting.findFirst({
        where: { id: meetingId, eventId, organizationId: tenant.organizationId },
      });
      if (!meeting) {
        throw AppException.notFound('not_found', 'Meeting not found.');
      }
      const settings = await requireModule(tx, eventId, 'meetings');
      assertCanConfirmMeeting(meeting.status, settings.requiresStaffConfirmation !== false);
      const row = await tx.meeting.update({ where: { id: meeting.id }, data: { status: 'CONFIRMED' } });
      await writeAudit(tx, {
        organizationId: tenant.organizationId,
        actorUserId: tenant.userId,
        action: 'meeting.confirmed',
        targetType: 'meeting',
        targetId: meeting.id,
      });
      return (await this.views(tx, tenant.organizationId, [row]))[0];
    });
  }

  recordOutcome(eventId: string, meetingId: string, input: MeetingOutcomeRequest): Promise<MeetingView> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const meeting = await tx.meeting.findFirst({
        where: { id: meetingId, eventId, organizationId: tenant.organizationId },
      });
      if (!meeting) {
        throw AppException.notFound('not_found', 'Meeting not found.');
      }
      if (input.status === 'COMPLETED') {
        const settings = await requireModule(tx, eventId, 'meetings');
        assertCanComplete(meeting.status, settings.requiresStaffConfirmation !== false);
      }
      const row = await tx.meeting.update({
        where: { id: meeting.id },
        data: { status: input.status, outcome: input.outcome ?? null },
      });
      await writeAudit(tx, {
        organizationId: tenant.organizationId,
        actorUserId: tenant.userId,
        action: 'meeting.outcome_recorded',
        targetType: 'meeting',
        targetId: meeting.id,
      });
      return (await this.views(tx, tenant.organizationId, [row]))[0];
    });
  }

  private async views(
    tx: import('../../database/tenant-transaction.service').TenantPrismaClient,
    organizationId: string,
    rows: Row[],
  ): Promise<MeetingView[]> {
    const ids = [...new Set(rows.flatMap((r) => [r.proposerRegistrationId, r.inviteeRegistrationId]))];
    const registrations = await tx.registration.findMany({
      where: { id: { in: ids }, organizationId },
      select: { id: true, ...PEOPLE.select },
    });
    const names = new Map(registrations.map((r) => [r.id, nameOf(r.person)]));

    return rows.map((r) => ({
      id: r.id,
      proposerRegistrationId: r.proposerRegistrationId,
      proposerName: names.get(r.proposerRegistrationId) ?? '',
      inviteeRegistrationId: r.inviteeRegistrationId,
      inviteeName: names.get(r.inviteeRegistrationId) ?? '',
      message: r.message,
      proposedStart: r.proposedStart ? r.proposedStart.toISOString() : null,
      proposedEnd: r.proposedEnd ? r.proposedEnd.toISOString() : null,
      location: r.location,
      status: r.status,
      outcome: r.outcome,
      createdAt: r.createdAt.toISOString(),
    }));
  }
}
