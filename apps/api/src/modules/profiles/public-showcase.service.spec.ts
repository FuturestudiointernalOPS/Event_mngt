import { describe, expect, it } from 'vitest';
import type { TenantPrismaClient, TenantTransactionService } from '../../database/tenant-transaction.service';
import { AppException } from '../../common/app-exception';
import { EventStatus, EventVisibility, type Innovation, type Person } from '../../database/prisma-client';
import type { EventsService, PublicEventTarget } from '../events/events.service';
import type { ModuleRegistryService } from '../module-registry/module-registry.service';
import type { ParticipantProfilesRepository, ParticipantProfileWithReference } from './participant-profiles.repository';
import { PublicShowcaseService } from './public-showcase.service';
import type { ShowcaseRepository } from './showcase.repository';

const TX = {} as TenantPrismaClient;

const TARGET: PublicEventTarget = {
  id: 'event-1',
  organizationId: 'org-1',
  slug: 'village-2026',
  name: 'Village 2026',
  status: EventStatus.PUBLISHED,
  visibility: EventVisibility.PUBLIC,
  registrationOpensAt: null,
  registrationClosesAt: null,
};

function personRow(): Person {
  return {
    id: 'person-1',
    organizationId: 'org-1',
    email: 'amina@example.test',
    firstName: 'Amina',
    lastName: 'Dossou',
    phone: '+229 00000000',
    organizationName: null,
    jobTitle: null,
    country: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function profileRow(): ParticipantProfileWithReference {
  return {
    id: 'profile-1',
    organizationId: 'org-1',
    eventId: 'event-1',
    registrationId: 'registration-1',
    headline: 'Founder',
    bio: 'Builds things',
    company: 'Acme',
    jobTitle: 'CEO',
    websiteUrl: 'https://acme.example.test',
    photoUrl: null,
    links: null,
    visibility: 'PUBLIC',
    moderationStatus: 'APPROVED',
    submittedAt: new Date(),
    moderatedAt: new Date(),
    moderatedByUserId: 'user-1',
    moderationNote: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    registration: { reference: 'EP-ABCDEF', person: personRow() },
  };
}

function innovationRow(): Innovation {
  return {
    id: 'innovation-1',
    organizationId: 'org-1',
    eventId: 'event-1',
    participantProfileId: 'profile-1',
    organizationProfileId: null,
    title: 'Solar kiosk',
    summary: 'Off-grid power',
    category: 'Energy',
    externalUrl: null,
    imageUrl: null,
    visibility: 'PUBLIC',
    moderationStatus: 'APPROVED',
    submittedAt: new Date(),
    moderatedAt: new Date(),
    moderatedByUserId: 'user-1',
    moderationNote: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function harness(options: { target?: PublicEventTarget | null; enabled?: boolean } = {}) {
  const target = options.target === undefined ? TARGET : options.target;

  const profiles = {
    listPublic: async () => [profileRow()],
  } as unknown as ParticipantProfilesRepository;

  const showcase = {
    listPublic: async () => [innovationRow()],
  } as unknown as ShowcaseRepository;

  const events = {
    findPublicTarget: async () => target,
  } as unknown as EventsService;

  const modules = {
    requireEnabledSettings: async () => {
      if (options.enabled === false) {
        throw AppException.notFound('not_found', 'Event not found.');
      }
      return {};
    },
  } as unknown as ModuleRegistryService;

  const tenantTransaction = {
    withOrganizationScope: async (
      _organizationId: string,
      callback: (tx: TenantPrismaClient) => unknown,
    ) => callback(TX),
  } as unknown as TenantTransactionService;

  return new PublicShowcaseService(
    tenantTransaction,
    profiles,
    showcase,
    events,
    modules,
  );
}

describe('public showcase', () => {
  it('projects approved profiles and listings', async () => {
    const showcase = await harness().get('village-2026');

    expect(showcase.profiles).toEqual([
      {
        displayName: 'Amina Dossou',
        headline: 'Founder',
        bio: 'Builds things',
        company: 'Acme',
        jobTitle: 'CEO',
        websiteUrl: 'https://acme.example.test',
        photoUrl: null,
      },
    ]);
    expect(showcase.innovations).toEqual([
      {
        title: 'Solar kiosk',
        summary: 'Off-grid power',
        category: 'Energy',
        externalUrl: null,
        imageUrl: null,
      },
    ]);
  });

  it('never leaks contact details into the public projection', async () => {
    const showcase = await harness().get('village-2026');
    const serialised = JSON.stringify(showcase);

    expect(serialised).not.toContain('amina@example.test');
    expect(serialised).not.toContain('+229');
    expect(serialised).not.toContain('registrationId');
  });

  it('is not found for an unknown event', async () => {
    await expect(
      harness({ target: null }).get('missing'),
    ).rejects.toMatchObject({ code: 'not_found' });
  });

  it('is not found when the showcase module is disabled', async () => {
    await expect(
      harness({ enabled: false }).get('village-2026'),
    ).rejects.toMatchObject({ code: 'not_found' });
  });
});
