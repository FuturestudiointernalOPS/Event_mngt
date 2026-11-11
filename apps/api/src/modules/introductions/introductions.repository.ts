import { Injectable } from '@nestjs/common';
import type { TenantPrismaClient } from '../../database/tenant-transaction.service';
import {
  MemberStatus,
  ModerationStatus,
  Prisma,
  ProfileVisibility,
  type IntroductionOutcome,
  type IntroductionRequest,
  type IntroductionStatus,
  type IntroductionStatusHistory,
} from '../../database/prisma-client';

const PROFILE_SELECT = {
  id: true,
  registration: {
    select: { person: { select: { firstName: true, lastName: true } } },
  },
} as const;

const REQUEST_INCLUDE = {
  requestingProfile: { select: PROFILE_SELECT },
} as const satisfies Prisma.IntroductionRequestInclude;

const DETAIL_INCLUDE = {
  requestingProfile: { select: PROFILE_SELECT },
  statusHistory: { orderBy: { createdAt: 'asc' as const } },
} as const satisfies Prisma.IntroductionRequestInclude;

export interface IntroductionProfileRow {
  id: string;
  registration: { person: { firstName: string; lastName: string } };
}

export type IntroductionRequestRow = IntroductionRequest & {
  requestingProfile: IntroductionProfileRow;
};

export type IntroductionDetailRow = IntroductionRequestRow & {
  statusHistory: IntroductionStatusHistory[];
};

export interface CreateIntroductionData {
  organizationId: string;
  eventId: string;
  requestingProfileId: string;
  reason: string | null;
  offeredHelp: string | null;
  status: IntroductionStatus;
  assignedToUserId: string | null;
}

export interface UpdateIntroductionData {
  status: IntroductionStatus;
  assignedToUserId?: string | null;
  decidedAt?: Date | null;
  decidedByUserId?: string | null;
  outcome?: IntroductionOutcome | null;
  outcomeNotes?: string | null;
}

export interface TransitionIntroductionData {
  organizationId: string;
  eventId: string;
  requestId: string;
  fromStatus: IntroductionStatus | null;
  toStatus: IntroductionStatus;
  actorUserId: string;
  note: string | null;
  data: UpdateIntroductionData;
}

/**
 * Introduction queue queries. Every predicate carries the organisation and the event,
 * so a request or profile id from another tenant is simply absent (R7).
 */
@Injectable()
export class IntroductionsRepository {
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

  /** Only approved, public profiles of this event can request an introduction. */
  findEligibleProfile(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
    profileId: string,
  ): Promise<IntroductionProfileRow | null> {
    return tx.participantProfile.findFirst({
      where: {
        id: profileId,
        organizationId,
        eventId,
        moderationStatus: ModerationStatus.APPROVED,
        visibility: ProfileVisibility.PUBLIC,
      },
      select: PROFILE_SELECT,
    });
  }

  /**
   * The assignee must be an active member of this organisation whose role grants
   * `introduction:manage`; any other user id is refused as an invalid reference.
   */
  findMemberWithPermission(
    tx: TenantPrismaClient,
    organizationId: string,
    userId: string,
    permission: string,
  ): Promise<{ id: string } | null> {
    return tx.organizationMember.findFirst({
      where: {
        organizationId,
        userId,
        status: MemberStatus.ACTIVE,
        role: { permissions: { some: { permission: { key: permission } } } },
      },
      select: { id: true },
    });
  }

  list(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
    status: IntroductionStatus | undefined,
    skip: number,
    take: number,
  ): Promise<[IntroductionRequestRow[], number]> {
    const where = { organizationId, eventId, status };

    return Promise.all([
      tx.introductionRequest.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip,
        take,
        include: REQUEST_INCLUDE,
      }),
      tx.introductionRequest.count({ where }),
    ]);
  }

  findRequest(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
    requestId: string,
  ): Promise<IntroductionRequestRow | null> {
    return tx.introductionRequest.findFirst({
      where: { id: requestId, organizationId, eventId },
      include: REQUEST_INCLUDE,
    });
  }

  findDetail(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
    requestId: string,
  ): Promise<IntroductionDetailRow | null> {
    return tx.introductionRequest.findFirst({
      where: { id: requestId, organizationId, eventId },
      include: DETAIL_INCLUDE,
    });
  }

  /**
   * Creation and its first history row commit together: a request cannot exist without
   * the transition that produced it.
   */
  async createWithHistory(
    tx: TenantPrismaClient,
    data: CreateIntroductionData,
    actorUserId: string,
  ): Promise<IntroductionRequestRow> {
    const row = await tx.introductionRequest.create({
      data,
      include: REQUEST_INCLUDE,
    });

    await this.appendHistory(tx, {
      organizationId: data.organizationId,
      eventId: data.eventId,
      requestId: row.id,
      fromStatus: null,
      toStatus: data.status,
      actorUserId,
      note: null,
    });

    return row;
  }

  /**
   * A transition and exactly one history row, written together. History is append-only:
   * the table has no update or delete method here or anywhere else.
   */
  async transition(
    tx: TenantPrismaClient,
    input: TransitionIntroductionData,
  ): Promise<IntroductionRequestRow> {
    const row = await tx.introductionRequest.update({
      where: {
        id: input.requestId,
        organizationId: input.organizationId,
        eventId: input.eventId,
      },
      data: input.data,
      include: REQUEST_INCLUDE,
    });

    await this.appendHistory(tx, input);

    return row;
  }

  private appendHistory(
    tx: TenantPrismaClient,
    data: Omit<TransitionIntroductionData, 'data'>,
  ): Promise<IntroductionStatusHistory> {
    return tx.introductionStatusHistory.create({ data });
  }
}
