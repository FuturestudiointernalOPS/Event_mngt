import { Injectable } from '@nestjs/common';
import type { TenantPrismaClient } from '../../database/tenant-transaction.service';
import type {
  Badge as BadgeRow,
  BadgeStatus,
  RegistrationStatus,
} from '../../database/prisma-client';

export type BadgeWithReference = BadgeRow & {
  registration: { reference: string };
};

export interface BadgeRegistration {
  id: string;
  eventId: string;
  status: RegistrationStatus;
  reference: string;
  person: { email: string; firstName: string; lastName: string };
  event: { name: string; slug: string };
}

export interface BadgeVerification {
  badgeId: string;
  registrationId: string;
  status: BadgeStatus;
}

/**
 * Badge rows and the registration facts a badge email needs.
 *
 * Every query carries the organisation predicate; the registration lookup carries the
 * event too, so a registration id from another event in the same tenant is not found.
 */
@Injectable()
export class BadgesRepository {
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
  ): Promise<BadgeRegistration | null> {
    return tx.registration.findFirst({
      where: { id: registrationId, organizationId, eventId },
      select: {
        id: true,
        eventId: true,
        status: true,
        reference: true,
        person: { select: { email: true, firstName: true, lastName: true } },
        event: { select: { name: true, slug: true } },
      },
    });
  }

  /** Hash lookup for check-in (WP-15). A token from another event is absent. */
  async verifyForEvent(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
    tokenHash: string,
  ): Promise<BadgeVerification | null> {
    const row = await tx.badge.findFirst({
      where: { organizationId, eventId, tokenHash },
      select: { id: true, registrationId: true, status: true },
    });

    return row
      ? { badgeId: row.id, registrationId: row.registrationId, status: row.status }
      : null;
  }

  findBadge(
    tx: TenantPrismaClient,
    organizationId: string,
    registrationId: string,
  ): Promise<BadgeWithReference | null> {
    return tx.badge.findFirst({
      where: { organizationId, registrationId },
      include: { registration: { select: { reference: true } } },
    });
  }

  create(
    tx: TenantPrismaClient,
    data: {
      organizationId: string;
      eventId: string;
      registrationId: string;
      tokenHash: string;
    },
  ): Promise<BadgeWithReference> {
    return tx.badge.create({
      data,
      include: { registration: { select: { reference: true } } },
    });
  }

  update(
    tx: TenantPrismaClient,
    organizationId: string,
    badgeId: string,
    data: {
      tokenHash?: string;
      status?: BadgeStatus;
      issuedAt?: Date;
      revokedAt?: Date | null;
      reissuedAt?: Date | null;
      reissueCount?: { increment: number };
    },
  ): Promise<BadgeWithReference> {
    return tx.badge.update({
      where: { id: badgeId, organizationId },
      data,
      include: { registration: { select: { reference: true } } },
    });
  }

  list(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
    status: BadgeStatus | undefined,
    skip: number,
    take: number,
  ): Promise<[BadgeWithReference[], number]> {
    const where = { organizationId, eventId, status };

    return Promise.all([
      tx.badge.findMany({
        where,
        orderBy: { issuedAt: 'desc' },
        skip,
        take,
        include: { registration: { select: { reference: true } } },
      }),
      tx.badge.count({ where }),
    ]);
  }
}
