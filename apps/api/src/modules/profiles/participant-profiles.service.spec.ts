import { describe, expect, it } from 'vitest';
import type { TenantPrismaClient, TenantTransactionService } from '../../database/tenant-transaction.service';
import type { Person } from '../../database/prisma-client';
import type { ModuleRegistryService } from '../module-registry/module-registry.service';
import type { ParticipantProfilesRepository } from './participant-profiles.repository';
import type { ParticipantProfileWithReference } from './participant-profiles.repository';
import { ParticipantProfilesService } from './participant-profiles.service';

const TX = {} as TenantPrismaClient;
const TENANT = {
  organizationId: 'org-1',
  userId: 'user-1',
  membershipId: 'member-1',
  permissions: [],
};

function personRow(): Person {
  return {
    id: 'person-1',
    organizationId: 'org-1',
    email: 'amina@example.test',
    firstName: 'Amina',
    lastName: 'Dossou',
    phone: null,
    organizationName: null,
    jobTitle: null,
    country: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function profileRow(
  overrides: Partial<ParticipantProfileWithReference> = {},
): ParticipantProfileWithReference {
  return {
    id: 'profile-1',
    organizationId: 'org-1',
    eventId: 'event-1',
    registrationId: 'registration-1',
    headline: null,
    bio: null,
    company: null,
    jobTitle: null,
    websiteUrl: null,
    photoUrl: null,
    links: null,
    visibility: 'PRIVATE',
    moderationStatus: 'DRAFT',
    submittedAt: null,
    moderatedAt: null,
    moderatedByUserId: null,
    moderationNote: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    registration: { reference: 'EP-ABCDEF', person: personRow() },
    ...overrides,
  };
}

interface Options {
  registration?: boolean;
  existing?: ParticipantProfileWithReference | null;
  settings?: Record<string, unknown>;
}

function harness(options: Options = {}) {
  const created: Array<Record<string, unknown>> = [];
  const updates: Array<Record<string, unknown>> = [];
  let existing = options.existing ?? null;

  const repository = {
    eventExists: async () => ({ id: 'event-1' }),
    findRegistration: async () =>
      options.registration === false
        ? null
        : { id: 'registration-1', reference: 'EP-ABCDEF', person: personRow() },
    findByRegistration: async () => existing,
    find: async () => existing,
    create: async (_tx: unknown, data: Record<string, unknown>) => {
      created.push(data);
      existing = profileRow({
        headline: (data.headline as string | null) ?? null,
        visibility: data.visibility as ParticipantProfileWithReference['visibility'],
        moderationStatus: data.moderationStatus as ParticipantProfileWithReference['moderationStatus'],
      });
      return existing;
    },
    update: async (
      _tx: unknown,
      _organizationId: string,
      _eventId: string,
      _profileId: string,
      data: Record<string, unknown>,
    ) => {
      updates.push(data);
      // Prisma ignores undefined members, so the fake must too.
      const changed = Object.fromEntries(
        Object.entries(data).filter(([, value]) => value !== undefined),
      );
      existing = profileRow({
        ...existing,
        ...changed,
        registration: { reference: 'EP-ABCDEF', person: personRow() },
      } as Partial<ParticipantProfileWithReference>);
      return existing;
    },
  } as unknown as ParticipantProfilesRepository;

  const modules = {
    requireEnabledSettings: async () =>
      options.settings ?? { publicByDefault: false, allowParticipantEditing: true },
  } as unknown as ModuleRegistryService;

  const tenantTransaction = {
    withTenant: async (
      callback: (tx: TenantPrismaClient, tenant: typeof TENANT) => unknown,
    ) => callback(TX, TENANT),
  } as unknown as TenantTransactionService;

  return {
    service: new ParticipantProfilesService(tenantTransaction, repository, modules),
    created,
    updates,
  };
}

describe('participant profile upsert', () => {
  it('creates a draft profile with the module default visibility', async () => {
    const { service, created } = harness({
      settings: { publicByDefault: true },
    });

    const profile = await service.upsert('event-1', 'registration-1', {
      headline: 'Founder',
    });

    expect(created[0]).toMatchObject({
      organizationId: 'org-1',
      eventId: 'event-1',
      registrationId: 'registration-1',
      visibility: 'PUBLIC',
      moderationStatus: 'DRAFT',
      headline: 'Founder',
    });
    expect(profile.moderationStatus).toBe('DRAFT');
    expect(profile.reference).toBe('EP-ABCDEF');
  });

  it('submits for review when asked', async () => {
    const { service, created } = harness();

    await service.upsert('event-1', 'registration-1', {
      headline: 'Founder',
      submitForReview: true,
    });

    expect(created[0].moderationStatus).toBe('PENDING');
    expect(created[0].submittedAt).toBeInstanceOf(Date);
  });

  it('invalidates an approval when the content is edited', async () => {
    const { service, updates } = harness({
      existing: profileRow({ moderationStatus: 'APPROVED', visibility: 'PUBLIC' }),
    });

    const profile = await service.update('event-1', 'profile-1', {
      headline: 'A new headline',
    });

    expect(updates[0].moderationStatus).toBe('DRAFT');
    expect(profile.visibility).toBe('PUBLIC');
  });

  it('reports a registration from another tenant as not found', async () => {
    const { service } = harness({ registration: false });

    await expect(
      service.upsert('event-1', 'foreign-registration', {}),
    ).rejects.toMatchObject({ code: 'not_found' });
  });
});

describe('participant profile moderation', () => {
  it('approves a submitted profile and records the moderator', async () => {
    const { service, updates } = harness({
      existing: profileRow({ moderationStatus: 'PENDING' }),
    });

    const profile = await service.moderate('event-1', 'profile-1', {
      decision: 'APPROVED',
    });

    expect(updates[0]).toMatchObject({
      moderationStatus: 'APPROVED',
      moderatedByUserId: 'user-1',
    });
    expect(updates[0].moderatedAt).toBeInstanceOf(Date);
    expect(profile.moderationStatus).toBe('APPROVED');
  });

  it('refuses to approve a draft', async () => {
    const { service } = harness({ existing: profileRow() });

    await expect(
      service.moderate('event-1', 'profile-1', { decision: 'APPROVED' }),
    ).rejects.toMatchObject({ code: 'invalid_status_transition' });
  });

  it('refuses a repeated approval', async () => {
    const { service } = harness({
      existing: profileRow({ moderationStatus: 'APPROVED' }),
    });

    await expect(
      service.moderate('event-1', 'profile-1', { decision: 'APPROVED' }),
    ).rejects.toMatchObject({ code: 'conflict' });
  });
});
