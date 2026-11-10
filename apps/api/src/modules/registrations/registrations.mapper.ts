import type {
  PersonSummary,
  RegistrationAnswerValue,
  RegistrationDetail,
  RegistrationSummary,
} from '@event-platform/shared';
import type {
  Badge,
  ConsentRecord,
  ParticipantCategory,
  Person,
  Registration,
  RegistrationAnswer,
} from '../../database/prisma-client';

/** Row shapes the mappers accept, named so the Prisma payload stays in one place. */
export type RegistrationWithPerson = Registration & {
  person: Person;
  category: ParticipantCategory | null;
};

export type RegistrationDetailRow = RegistrationWithPerson & {
  answers: RegistrationAnswer[];
  consents: ConsentRecord[];
  badge: Badge | null;
};

function toPersonSummary(person: Person): PersonSummary {
  return {
    id: person.id,
    email: person.email,
    firstName: person.firstName,
    lastName: person.lastName,
    phone: person.phone,
    organizationName: person.organizationName,
    jobTitle: person.jobTitle,
    country: person.country,
  };
}

export function toSummary(row: RegistrationWithPerson): RegistrationSummary {
  return {
    id: row.id,
    reference: row.reference,
    status: row.status,
    source: row.source,
    submittedAt: row.submittedAt.toISOString(),
    decidedAt: row.decidedAt ? row.decidedAt.toISOString() : null,
    person: toPersonSummary(row.person),
    category: row.category
      ? { key: row.category.key, name: row.category.name }
      : null,
  };
}

export function toDetail(row: RegistrationDetailRow): RegistrationDetail {
  return {
    ...toSummary(row),
    answers: row.answers.map((answer) => ({
      fieldKey: answer.fieldKey,
      value: answer.value as RegistrationAnswerValue,
    })),
    consents: row.consents.map((consent) => ({
      key: consent.documentKey,
      version: consent.documentVersion,
      acceptedAt: consent.acceptedAt.toISOString(),
    })),
    badge: row.badge
      ? {
          status: row.badge.status,
          issuedAt: row.badge.issuedAt.toISOString(),
        }
      : null,
  };
}
