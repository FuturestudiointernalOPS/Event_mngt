import { Injectable } from '@nestjs/common';
import type { TenantPrismaClient } from '../../database/tenant-transaction.service';
import {
  MeetingStatus,
  ModerationStatus,
  Prisma,
  ProfileVisibility,
  type Meeting,
  type MeetingOutcome,
} from '../../database/prisma-client';

const PROFILE_SELECT = {
  id: true,
  registration: {
    select: { person: { select: { firstName: true, lastName: true } } },
  },
} as const;

const MEETING_INCLUDE = {
  proposer: { select: PROFILE_SELECT },
  recipient: { select: PROFILE_SELECT },
} as const satisfies Prisma.MeetingInclude;

const ACTIVE_STATUSES: MeetingStatus[] = [
  MeetingStatus.PROPOSED,
  MeetingStatus.ACCEPTED,
];

export interface MeetingProfileRow {
  id: string;
  registration: { person: { firstName: string; lastName: string } };
}

export type MeetingRow = Meeting & {
  proposer: MeetingProfileRow;
  recipient: MeetingProfileRow;
};

export interface CreateMeetingData {
  organizationId: string;
  eventId: string;
  proposerProfileId: string;
  recipientProfileId: string;
  durationMinutes: number;
  note: string | null;
  requiresStaffConfirmation: boolean;
}

export interface UpdateMeetingData {
  status: MeetingStatus;
  decidedAt: Date;
  decidedByUserId: string;
  outcome?: MeetingOutcome | null;
  outcomeNotes?: string | null;
}

/**
 * Meeting queries. Every predicate carries the organisation and the event, so a
 * meeting or profile id from another tenant is simply absent (R7).
 */
@Injectable()
export class MeetingsRepository {
  eventExists(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
  ): Promise<{ id: string } | null> {
    return tx.event.findFirst({
      where: { id: eventId, organizationId },
      select: { id: true },
    });
  }

  /** Only approved, public profiles of this event can be paired. */
  findEligibleProfiles(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
    profileIds: string[],
  ): Promise<MeetingProfileRow[]> {
    return tx.participantProfile.findMany({
      where: {
        id: { in: profileIds },
        organizationId,
        eventId,
        moderationStatus: ModerationStatus.APPROVED,
        visibility: ProfileVisibility.PUBLIC,
      },
      select: PROFILE_SELECT,
    });
  }

  /** One active meeting per pair, checked in both directions. */
  findActiveForPair(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
    firstProfileId: string,
    secondProfileId: string,
  ): Promise<{ id: string } | null> {
    return tx.meeting.findFirst({
      where: {
        organizationId,
        eventId,
        status: { in: ACTIVE_STATUSES },
        OR: [
          {
            proposerProfileId: firstProfileId,
            recipientProfileId: secondProfileId,
          },
          {
            proposerProfileId: secondProfileId,
            recipientProfileId: firstProfileId,
          },
        ],
      },
      select: { id: true },
    });
  }

  countActiveProposals(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
    proposerProfileId: string,
  ): Promise<number> {
    return tx.meeting.count({
      where: {
        organizationId,
        eventId,
        proposerProfileId,
        status: { in: ACTIVE_STATUSES },
      },
    });
  }

  create(tx: TenantPrismaClient, data: CreateMeetingData): Promise<MeetingRow> {
    return tx.meeting.create({ data, include: MEETING_INCLUDE });
  }

  list(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
    status: MeetingStatus | undefined,
    skip: number,
    take: number,
  ): Promise<[MeetingRow[], number]> {
    const where = { organizationId, eventId, status };

    return Promise.all([
      tx.meeting.findMany({
        where,
        orderBy: [{ proposedAt: 'desc' }],
        skip,
        take,
        include: MEETING_INCLUDE,
      }),
      tx.meeting.count({ where }),
    ]);
  }

  find(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
    meetingId: string,
  ): Promise<MeetingRow | null> {
    return tx.meeting.findFirst({
      where: { id: meetingId, organizationId, eventId },
      include: MEETING_INCLUDE,
    });
  }

  update(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
    meetingId: string,
    data: UpdateMeetingData,
  ): Promise<MeetingRow> {
    return tx.meeting.update({
      where: { id: meetingId, organizationId, eventId },
      data,
      include: MEETING_INCLUDE,
    });
  }
}
