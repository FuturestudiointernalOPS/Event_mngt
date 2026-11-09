import type { RegistrationDetail, RegistrationSummary } from '@event-platform/shared';
import type { Prisma } from '../../database/prisma-client';

export const REGISTRATION_SELECT = {
  id: true,
  status: true,
  answers: true,
  decisionNote: true,
  decidedAt: true,
  createdAt: true,
  person: { select: { firstName: true, lastName: true, email: true, phone: true } },
  category: { select: { key: true, name: true } },
  _count: { select: { checkIns: true } },
} as const satisfies Prisma.RegistrationSelect;

export type RegistrationRow = Prisma.RegistrationGetPayload<{ select: typeof REGISTRATION_SELECT }>;

export function toRegistrationSummary(row: RegistrationRow): RegistrationSummary {
  return {
    id: row.id,
    status: row.status,
    firstName: row.person.firstName,
    lastName: row.person.lastName,
    email: row.person.email,
    categoryKey: row.category.key,
    categoryName: row.category.name,
    checkedIn: row._count.checkIns > 0,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toRegistrationDetail(
  row: RegistrationRow,
  consents: { purpose: string; policyVersion: string; granted: boolean; createdAt: Date }[],
): RegistrationDetail {
  return {
    ...toRegistrationSummary(row),
    phone: row.person.phone,
    answers: (row.answers as Record<string, string | boolean>) ?? {},
    decisionNote: row.decisionNote,
    decidedAt: row.decidedAt ? row.decidedAt.toISOString() : null,
    consents: consents.map((c) => ({
      purpose: c.purpose,
      policyVersion: c.policyVersion,
      granted: c.granted,
      createdAt: c.createdAt.toISOString(),
    })),
  };
}
