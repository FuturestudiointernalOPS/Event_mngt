import { Injectable } from '@nestjs/common';
import type { TenantPrismaClient } from '../../database/tenant-transaction.service';
import type {
  ModerationStatus,
  ParticipantProfile,
  Person,
  ProfileVisibility,
} from '../../database/prisma-client';

export type ParticipantProfileWithReference = ParticipantProfile & {
  registration: { reference: string; person: Person };
};

export interface ProfileContent {
  headline?: string | null;
  bio?: string | null;
  company?: string | null;
  jobTitle?: string | null;
  websiteUrl?: string | null;
  photoUrl?: string | null;
  visibility?: ProfileVisibility;
  moderationStatus?: ModerationStatus;
  submittedAt?: Date | null;
  moderatedAt?: Date | null;
  moderatedByUserId?: string | null;
  moderationNote?: string | null;
}

const WITH_PERSON = {
  registration: { select: { reference: true, person: true } },
} as const;

/**
 * Participant profiles for one event. Every predicate carries the organisation and the
 * event; a profile id from another tenant is absent, not refused.
 */
@Injectable()
export class ParticipantProfilesRepository {
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

  findRegistration(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
    registrationId: string,
  ): Promise<{ id: string; reference: string; person: Person } | null> {
    return tx.registration.findFirst({
      where: { id: registrationId, organizationId, eventId },
      select: { id: true, reference: true, person: true },
    });
  }

  list(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
    moderationStatus: ModerationStatus | undefined,
    skip: number,
    take: number,
  ): Promise<[ParticipantProfileWithReference[], number]> {
    const where = { organizationId, eventId, moderationStatus };

    return Promise.all([
      tx.participantProfile.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }],
        skip,
        take,
        include: WITH_PERSON,
      }),
      tx.participantProfile.count({ where }),
    ]);
  }

  find(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
    profileId: string,
  ): Promise<ParticipantProfileWithReference | null> {
    return tx.participantProfile.findFirst({
      where: { id: profileId, organizationId, eventId },
      include: WITH_PERSON,
    });
  }

  findByRegistration(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
    registrationId: string,
  ): Promise<ParticipantProfileWithReference | null> {
    return tx.participantProfile.findFirst({
      where: { organizationId, eventId, registrationId },
      include: WITH_PERSON,
    });
  }

  create(
    tx: TenantPrismaClient,
    data: ProfileContent & {
      organizationId: string;
      eventId: string;
      registrationId: string;
    },
  ): Promise<ParticipantProfileWithReference> {
    return tx.participantProfile.create({ data, include: WITH_PERSON });
  }

  update(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
    profileId: string,
    data: ProfileContent,
  ): Promise<ParticipantProfileWithReference> {
    return tx.participantProfile.update({
      where: { id: profileId, organizationId, eventId },
      data,
      include: WITH_PERSON,
    });
  }

  /** Approved, public and attached to an approved registration — all three. */
  listPublic(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
  ): Promise<ParticipantProfileWithReference[]> {
    return tx.participantProfile.findMany({
      where: {
        organizationId,
        eventId,
        moderationStatus: 'APPROVED',
        visibility: 'PUBLIC',
        registration: { status: 'APPROVED' },
      },
      orderBy: [{ updatedAt: 'desc' }],
      include: WITH_PERSON,
    });
  }
}
