import { Injectable } from '@nestjs/common';
import type { TenantPrismaClient } from '../../database/tenant-transaction.service';
import {
  Prisma,
  RegistrationSource,
  RegistrationStatus,
  type Person,
} from '../../database/prisma-client';
import type { StoredAnswer } from './registration-answers';
import { erasedPerson } from './registrations.erasure';
import type {
  RegistrationDetailRow,
  RegistrationWithPerson,
} from './registrations.mapper';

export interface CreatePersonData {
  organizationId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  organizationName: string | null;
  jobTitle: string | null;
  country: string | null;
}

export interface CreateRegistrationData {
  organizationId: string;
  eventId: string;
  personId: string;
  categoryId: string | null;
  reference: string;
  status: RegistrationStatus;
  answers: StoredAnswer[];
}

const DETAIL_INCLUDE = {
  person: true,
  category: true,
  answers: { orderBy: { fieldKey: 'asc' } },
  consents: { orderBy: { acceptedAt: 'asc' } },
  badge: true,
} as const satisfies Prisma.RegistrationInclude;

/**
 * Registration queries. Every predicate carries the organisation and the event, so a
 * registration id from another event or tenant is simply absent (R7).
 */
@Injectable()
export class RegistrationsRepository {
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

  findPersonByEmail(
    tx: TenantPrismaClient,
    organizationId: string,
    email: string,
  ): Promise<Person | null> {
    return tx.person.findFirst({ where: { organizationId, email } });
  }

  createPerson(tx: TenantPrismaClient, data: CreatePersonData): Promise<Person> {
    return tx.person.create({ data });
  }

  /** Any earlier registration for the same person in this event, for duplicate policy. */
  findDuplicate(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
    personId: string,
  ): Promise<{ id: string; reference: string } | null> {
    return tx.registration.findFirst({
      where: { organizationId, eventId, personId },
      select: { id: true, reference: true },
    });
  }

  findReference(
    tx: TenantPrismaClient,
    eventId: string,
    reference: string,
  ): Promise<{ id: string } | null> {
    return tx.registration.findFirst({
      where: { eventId, reference },
      select: { id: true },
    });
  }

  create(
    tx: TenantPrismaClient,
    data: CreateRegistrationData,
  ): Promise<RegistrationWithPerson> {
    return tx.registration.create({
      data: {
        organizationId: data.organizationId,
        eventId: data.eventId,
        personId: data.personId,
        categoryId: data.categoryId,
        reference: data.reference,
        status: data.status,
        source: RegistrationSource.PUBLIC,
        answers: {
          create: data.answers.map((answer) => ({
            organizationId: data.organizationId,
            fieldId: answer.fieldId,
            fieldKey: answer.fieldKey,
            value: answer.value as Prisma.InputJsonValue,
          })),
        },
      },
      include: { person: true, category: true },
    });
  }

  findStatus(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
    registrationId: string,
  ): Promise<{ id: string; status: RegistrationStatus } | null> {
    return tx.registration.findFirst({
      where: { id: registrationId, organizationId, eventId },
      select: { id: true, status: true },
    });
  }

  decide(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
    registrationId: string,
    data: {
      status: RegistrationStatus;
      decidedAt: Date;
      decidedByUserId: string;
      decisionReason: string | null;
    },
  ): Promise<RegistrationDetailRow> {
    return tx.registration.update({
      where: { id: registrationId, organizationId, eventId },
      data,
      include: DETAIL_INCLUDE,
    });
  }

  list(
    tx: TenantPrismaClient,
    where: Prisma.RegistrationWhereInput,
    orderBy: Prisma.RegistrationOrderByWithRelationInput,
    skip: number,
    take: number,
  ): Promise<[RegistrationWithPerson[], number]> {
    return Promise.all([
      tx.registration.findMany({
        where,
        orderBy,
        skip,
        take,
        include: { person: true, category: true },
      }),
      tx.registration.count({ where }),
    ]);
  }

  findDetail(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
    registrationId: string,
  ): Promise<RegistrationDetailRow | null> {
    return tx.registration.findFirst({
      where: { id: registrationId, organizationId, eventId },
      include: DETAIL_INCLUDE,
    });
  }

  /**
   * Destroys the link between a person and reality, for every registration they hold in
   * this organisation.
   *
   * The registration and check-in rows stay, so counts, reports and issued badges remain
   * correct; answers, profile and listing content go, and the meetings or introductions that
   * referenced the profile go with it (their foreign keys cascade from the profile).
   */
  /**
   * Takes the category's row lock and reports whether a seat is left. The lock serialises
   * concurrent submissions for the same category, so two requests can never both take
   * the last seat; it is released when the surrounding transaction ends. A category
   * without a capacity always has room.
   */
  async hasSeatAvailable(
    tx: TenantPrismaClient,
    organizationId: string,
    categoryId: string,
  ): Promise<boolean> {
    const rows = await tx.$queryRaw<{ capacity: number | null }[]>`
      SELECT capacity FROM participant_categories
      WHERE id = ${categoryId}::uuid AND organization_id = ${organizationId}::uuid
      FOR UPDATE`;
    const capacity = rows[0]?.capacity ?? null;

    if (capacity === null) {
      return true;
    }

    const taken = await tx.registration.count({
      where: {
        organizationId,
        categoryId,
        status: { in: [RegistrationStatus.PENDING, RegistrationStatus.APPROVED] },
      },
    });

    return taken < capacity;
  }
}
