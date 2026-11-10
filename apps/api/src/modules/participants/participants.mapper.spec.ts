import { describe, expect, it } from 'vitest';
import type {
  ParticipantCategory,
  Person,
  Registration,
} from '../../database/prisma-client';
import { toParticipantDetail, toParticipantSummary } from './participants.mapper';
import type { PersonWithRegistrations } from './participants.repository';

function personRow(): Person {
  return {
    id: 'person-1',
    organizationId: 'org-1',
    email: 'amina@example.test',
    firstName: 'Amina',
    lastName: 'Dossou',
    phone: null,
    organizationName: 'Acme',
    jobTitle: 'Founder',
    country: 'BJ',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function categoryRow(): ParticipantCategory {
  return {
    id: 'category-1',
    organizationId: 'org-1',
    eventId: 'event-1',
    key: 'startup',
    name: 'Startup',
    description: null,
    capacity: null,
    sortOrder: 0,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function registrationRow(
  category: ParticipantCategory | null,
): Registration & { category: ParticipantCategory | null } {
  return {
    id: 'registration-1',
    organizationId: 'org-1',
    eventId: 'event-1',
    personId: 'person-1',
    categoryId: category ? category.id : null,
    reference: 'EP-ABCDEF',
    status: 'PENDING',
    source: 'PUBLIC',
    submittedAt: new Date('2026-11-10T10:00:00.000Z'),
    decidedAt: null,
    decidedByUserId: null,
    decisionReason: null,
    createdAt: new Date('2026-11-10T10:00:00.000Z'),
    updatedAt: new Date('2026-11-10T10:00:00.000Z'),
    category,
  };
}

describe('participant mapping', () => {
  it('reports the registration count for one event', () => {
    const summary = toParticipantSummary({
      ...personRow(),
      _count: { registrations: 2 },
    });

    expect(summary.registrationCount).toBe(2);
    expect(summary.email).toBe('amina@example.test');
  });

  it('lists the registrations with their category', () => {
    const row: PersonWithRegistrations = {
      ...personRow(),
      registrations: [registrationRow(categoryRow()), registrationRow(null)],
    };

    const detail = toParticipantDetail(row);

    expect(detail.registrationCount).toBe(2);
    expect(detail.registrations[0]).toMatchObject({
      reference: 'EP-ABCDEF',
      category: { key: 'startup', name: 'Startup' },
    });
    expect(detail.registrations[1].category).toBeNull();
  });
});
