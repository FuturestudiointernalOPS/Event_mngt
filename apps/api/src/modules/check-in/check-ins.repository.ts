import { Injectable } from '@nestjs/common';
import type { TenantPrismaClient } from '../../database/tenant-transaction.service';
import {
  Prisma,
  type CheckIn as CheckInRow,
  type CheckInSource,
  type EventStatus,
} from '../../database/prisma-client';

/** The staff-facing projection: enough to confirm the person at the scanner. */
export interface CheckInWithParticipant extends CheckInRow {
  registration: {
    reference: string;
    person: { firstName: string; lastName: string };
    category: { name: string } | null;
  };
}

/** The registration facts a scan needs, without contact or answer data. */
export interface CheckInRegistration {
  id: string;
  eventId: string;
  reference: string;
  person: { firstName: string; lastName: string };
  category: { name: string } | null;
}

export interface CreateCheckInData {
  organizationId: string;
  eventId: string;
  registrationId: string;
  source: CheckInSource;
  scanId: string | null;
  scannedAt: Date;
  receivedAt: Date;
  checkedInByUserId: string | null;
  deviceId: string | null;
}

const PARTICIPANT_INCLUDE = {
  registration: {
    select: {
      reference: true,
      person: { select: { firstName: true, lastName: true } },
      category: { select: { name: true } },
    },
  },
} as const satisfies Prisma.CheckInInclude;

const PARTICIPANT_SELECT = {
  id: true,
  eventId: true,
  reference: true,
  person: { select: { firstName: true, lastName: true } },
  category: { select: { name: true } },
} as const satisfies Prisma.RegistrationSelect;

/** Newest first; the id break keeps the page stable for identical scan times. */
export const CHECK_IN_ORDER: Prisma.CheckInOrderByWithRelationInput[] = [
  { scannedAt: 'desc' },
  { createdAt: 'desc' },
];

/**
 * Attendance queries. Every predicate carries the organisation and the event, so a
 * registration, check-in or event from another tenant or event is simply absent (R7).
 *
 * The badges surface is never queried here: verification belongs to `BadgesService`.
 */
@Injectable()
export class CheckInsRepository {
  findEventStatus(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
  ): Promise<{ id: string; status: EventStatus } | null> {
    return tx.event.findFirst({
      where: { id: eventId, organizationId },
      select: { id: true, status: true },
    });
  }

  findRegistration(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
    registrationId: string,
  ): Promise<CheckInRegistration | null> {
    return tx.registration.findFirst({
      where: { id: registrationId, organizationId, eventId },
      select: PARTICIPANT_SELECT,
    });
  }

  findByRegistration(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
    registrationId: string,
  ): Promise<CheckInWithParticipant | null> {
    return tx.checkIn.findFirst({
      where: { organizationId, eventId, registrationId },
      include: PARTICIPANT_INCLUDE,
    });
  }

  /** Idempotent replay of a device-generated key, scoped to one event. */
  findByScanId(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
    scanId: string,
  ): Promise<CheckInWithParticipant | null> {
    return tx.checkIn.findFirst({
      where: { organizationId, eventId, scanId },
      include: PARTICIPANT_INCLUDE,
    });
  }

  create(
    tx: TenantPrismaClient,
    data: CreateCheckInData,
  ): Promise<CheckInWithParticipant> {
    return tx.checkIn.create({
      data,
      include: PARTICIPANT_INCLUDE,
    });
  }

  /**
   * The insert is the attendance invariant: a concurrent repeat scan hits the unique
   * pair on (event, registration) and is answered with the row that won the race.
   * `created` tells the caller whether this scan is the one that recorded it.
   */
  async createOrReturnExisting(
    tx: TenantPrismaClient,
    data: CreateCheckInData,
  ): Promise<{ row: CheckInWithParticipant; created: boolean }> {
    try {
      return { row: await this.create(tx, data), created: true };
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }

      // The conflict may be the attendance pair or the per-event scan id. Look up
      // the scan id first, because a replayed device key must return the stored scan
      // even when its badge token differs (WP-16).
      const existing =
        (data.scanId
          ? await this.findByScanId(
              tx,
              data.organizationId,
              data.eventId,
              data.scanId,
            )
          : null) ??
        (await this.findByRegistration(
          tx,
          data.organizationId,
          data.eventId,
          data.registrationId,
        ));

      if (!existing) {
        throw error;
      }

      return { row: existing, created: false };
    }
  }

  list(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
    skip: number,
    take: number,
  ): Promise<[CheckInWithParticipant[], number]> {
    const where = { organizationId, eventId };

    return Promise.all([
      tx.checkIn.findMany({
        where,
        orderBy: CHECK_IN_ORDER,
        skip,
        take,
        include: PARTICIPANT_INCLUDE,
      }),
      tx.checkIn.count({ where }),
    ]);
  }

  count(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
  ): Promise<number> {
    return tx.checkIn.count({ where: { organizationId, eventId } });
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}
