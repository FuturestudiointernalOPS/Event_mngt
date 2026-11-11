import type {
  ParticipantDetail,
  ParticipantSummary,
  RegistrationSummary,
} from '@event-platform/shared';
import type { ParticipantCategory, Person, Registration } from '../../database/prisma-client';
import type {
  PersonWithCount,
  PersonWithRegistrations,
} from './participants.repository';

/**
 * People are mapped locally instead of importing the registrations mapper: a module
 * consumes another module's service, never its internals (R10). The shape is the shared
 * contract, so drift between the two cannot go unnoticed.
 */

export function toParticipantSummary(row: PersonWithCount): ParticipantSummary {
  return {
    id: row.id,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    phone: row.phone,
    organizationName: row.organizationName,
    jobTitle: row.jobTitle,
    country: row.country,
    registrationCount: row._count.registrations,
  };
}

function toRegistrationSummary(
  person: Person,
  registration: Registration & { category: ParticipantCategory | null },
): RegistrationSummary {
  return {
    id: registration.id,
    reference: registration.reference,
    status: registration.status,
    source: registration.source,
    submittedAt: registration.submittedAt.toISOString(),
    decidedAt: registration.decidedAt ? registration.decidedAt.toISOString() : null,
    person: {
      id: person.id,
      email: person.email,
      firstName: person.firstName,
      lastName: person.lastName,
      phone: person.phone,
      organizationName: person.organizationName,
      jobTitle: person.jobTitle,
      country: person.country,
    },
    category: registration.category
      ? { key: registration.category.key, name: registration.category.name }
      : null,
  };
}

export function toParticipantDetail(row: PersonWithRegistrations): ParticipantDetail {
  return {
    id: row.id,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    phone: row.phone,
    organizationName: row.organizationName,
    jobTitle: row.jobTitle,
    country: row.country,
    registrationCount: row.registrations.length,
    registrations: row.registrations.map((registration) =>
      toRegistrationSummary(row, registration),
    ),
  };
}
