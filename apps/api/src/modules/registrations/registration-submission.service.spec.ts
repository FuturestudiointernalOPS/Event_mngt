import { describe, expect, it } from 'vitest';
import type {
  RegistrationField,
  SubmitRegistrationRequest,
} from '@event-platform/shared';
import type {
  TenantPrismaClient,
  TenantTransactionService,
} from '../../database/tenant-transaction.service';
import {
  EventStatus,
  EventVisibility,
  RegistrationSource,
  RegistrationStatus,
  type Person,
} from '../../database/prisma-client';
import type { BadgesService, IssuedBadgeNotice } from '../badges/badges.service';
import type { CategoriesService } from '../registration-forms/categories.service';
import type { RegistrationFormService } from '../registration-forms/registration-form.service';
import type { ConsentService } from '../consent/consent.service';
import type { EventsService, PublicEventTarget } from '../events/events.service';
import type { ModuleRegistryService } from '../module-registry/module-registry.service';
import { RegistrationSubmissionService } from './registration-submission.service';
import type { RegistrationsRepository } from './registrations.repository';
import type { RegistrationWithPerson } from './registrations.mapper';

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

function personRow(overrides: Partial<Person> = {}): Person {
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
    ...overrides,
  };
}

function registrationRow(
  overrides: Partial<RegistrationWithPerson> = {},
): RegistrationWithPerson {
  return {
    id: 'registration-1',
    organizationId: 'org-1',
    eventId: 'event-1',
    personId: 'person-1',
    categoryId: null,
    reference: 'EP-ABCDEF',
    status: RegistrationStatus.PENDING,
    source: RegistrationSource.PUBLIC,
    submittedAt: new Date('2026-11-10T10:00:00.000Z'),
    decidedAt: null,
    decidedByUserId: null,
    decisionReason: null,
    createdAt: new Date('2026-11-10T10:00:00.000Z'),
    updatedAt: new Date('2026-11-10T10:00:00.000Z'),
    person: personRow(),
    category: null,
    ...overrides,
  };
}

function field(overrides: Partial<RegistrationField> = {}): RegistrationField {
  return {
    id: 'field-1',
    key: 'motivation',
    label: 'Motivation',
    type: 'TEXT',
    required: true,
    placeholder: null,
    helpText: null,
    options: null,
    sortOrder: 0,
    ...overrides,
  };
}

function input(
  overrides: Partial<SubmitRegistrationRequest> = {},
): SubmitRegistrationRequest {
  return {
    email: 'Amina@Example.test',
    firstName: 'Amina',
    lastName: 'Dossou',
    answers: [{ fieldKey: 'motivation', value: 'Because' }],
    consents: [{ key: 'privacy', version: 1, accepted: true }],
    ...overrides,
  } as SubmitRegistrationRequest;
}

interface Options {
  target?: PublicEventTarget | null;
  settings?: Record<string, unknown>;
  existingPerson?: Person | null;
  duplicate?: { id: string; reference: string } | null;
  fields?: RegistrationField[];
  categoryAvailable?: boolean;
}

function harness(options: Options = {}) {
  const target = options.target === undefined ? TARGET : options.target;
  const created: Array<Record<string, unknown>> = [];
  const acceptances: Array<Record<string, unknown>> = [];
  const notices: IssuedBadgeNotice[] = [];
  let issueCalls = 0;
  let personCreates = 0;
  let notifications = 0;

  const repository = {
    findPersonByEmail: async () => options.existingPerson ?? null,
    createPerson: async (_tx: unknown, data: Record<string, unknown>) => {
      personCreates += 1;
      return personRow({ email: String(data.email) });
    },
    findDuplicate: async () => options.duplicate ?? null,
    findReference: async () => null,
    create: async (_tx: unknown, data: Record<string, unknown>) => {
      created.push(data);
      return registrationRow({
        status: data.status as RegistrationStatus,
        reference: String(data.reference),
        categoryId: (data.categoryId as string | null) ?? null,
      });
    },
  } as unknown as RegistrationsRepository;

  const forms = {
    formSnapshot: async () => options.fields ?? [field()],
  } as unknown as RegistrationFormService;

  const categories = {
    findCategoryByKey: async () =>
      options.categoryAvailable === false
        ? null
        : {
            id: 'category-1',
            key: 'startup',
            name: 'Startup',
            isActive: true,
          },
  } as unknown as CategoriesService;

  const consent = {
    requirementsFor: async () => [
      {
        id: 'document-1',
        key: 'privacy',
        version: 1,
        title: 'Privacy',
        body: 'Text',
        required: true,
      },
    ],
    recordAcceptances: async (_tx: unknown, call: Record<string, unknown>) => {
      acceptances.push(call);
    },
  } as unknown as ConsentService;

  const modules = {
    requireEnabledSettings: async () =>
      options.settings ?? { approvalMode: 'manual', duplicatePolicy: 'warn' },
  } as unknown as ModuleRegistryService;

  const events = {
    findPublicTarget: async () => target,
  } as unknown as EventsService;

  const badges = {
    issueForApproved: async () => {
      issueCalls += 1;
      const notice = {
        badge: {
          id: 'badge-1',
          registrationId: 'registration-1',
          reference: 'EP-ABCDEF',
          status: 'ISSUED',
          issuedAt: '2026-11-10T10:00:00.000Z',
          revokedAt: null,
          reissueCount: 0,
        },
        token: 'token',
        recipient: { email: 'amina@example.test', name: 'Amina Dossou' },
        event: { name: 'Village 2026', slug: 'village-2026' },
      } as IssuedBadgeNotice;
      notices.push(notice);
      return notice;
    },
    notifyIssued: async () => {
      notifications += 1;
    },
  } as unknown as BadgesService;

  const tenantTransaction = {
    withOrganizationScope: async (
      _organizationId: string,
      callback: (tx: TenantPrismaClient) => unknown,
    ) => callback(TX),
  } as unknown as TenantTransactionService;

  return {
    service: new RegistrationSubmissionService(
      tenantTransaction,
      repository,
      forms,
      categories,
      consent,
      modules,
      events,
      badges,
    ),
    created,
    acceptances,
    notices,
    counters: {
      get issueCalls() {
        return issueCalls;
      },
      get personCreates() {
        return personCreates;
      },
      get notifications() {
        return notifications;
      },
    },
  };
}

describe('registration submission', () => {
  it('stores the registration, its answers and its consents under the event organisation', async () => {
    const { service, created, acceptances } = harness({
      existingPerson: personRow(),
    });

    const receipt = await service.submit('village-2026', input(), '203.0.113.9');

    expect(receipt.reference).toBe(created[0].reference);
    expect(receipt.status).toBe('PENDING');
    expect(receipt.requiresApproval).toBe(true);
    expect(receipt.badgeIssued).toBe(false);
    expect(created[0]).toMatchObject({
      organizationId: 'org-1',
      eventId: 'event-1',
      personId: 'person-1',
      status: RegistrationStatus.PENDING,
    });
    expect(created[0].answers).toEqual([
      { fieldId: 'field-1', fieldKey: 'motivation', value: 'Because' },
    ]);
    expect(acceptances[0]).toMatchObject({
      organizationId: 'org-1',
      registrationId: 'registration-1',
      ipAddress: '203.0.113.9',
    });
  });

  it('reuses the person row for the same email in the same organisation', async () => {
    const { service, counters } = harness({ existingPerson: personRow() });

    await service.submit('village-2026', input(), null);

    expect(counters.personCreates).toBe(0);
  });

  it('creates a person when the email is new to this organisation', async () => {
    const { service, counters } = harness({ existingPerson: null });

    await service.submit('village-2026', input(), null);

    expect(counters.personCreates).toBe(1);
  });

  it('approves immediately and issues a badge in automatic mode', async () => {
    const { service, created, counters } = harness({
      existingPerson: personRow(),
      settings: { approvalMode: 'automatic', duplicatePolicy: 'warn' },
    });

    const receipt = await service.submit('village-2026', input(), null);

    expect(created[0].status).toBe(RegistrationStatus.APPROVED);
    expect(receipt.requiresApproval).toBe(false);
    expect(receipt.badgeIssued).toBe(true);
    expect(counters.issueCalls).toBe(1);
    expect(counters.notifications).toBe(1);
  });

  it('refuses a closed window', async () => {
    const { service } = harness({
      existingPerson: personRow(),
      target: {
        ...TARGET,
        registrationClosesAt: new Date('2026-11-09T00:00:00.000Z'),
      },
    });

    await expect(service.submit('village-2026', input(), null)).rejects.toMatchObject({
      code: 'registration_closed',
    });
  });

  it('refuses an invalid answer set before writing anything', async () => {
    const { service, created } = harness({
      existingPerson: personRow(),
      fields: [field({ required: true })],
    });

    await expect(
      service.submit('village-2026', input({ answers: [] }), null),
    ).rejects.toMatchObject({ code: 'validation_error' });

    expect(created).toEqual([]);
  });

  it('refuses a duplicate when the policy is block', async () => {
    const { service, created } = harness({
      existingPerson: personRow(),
      duplicate: { id: 'registration-0', reference: 'EP-ZZZZZZ' },
      settings: { approvalMode: 'manual', duplicatePolicy: 'block' },
    });

    await expect(service.submit('village-2026', input(), null)).rejects.toMatchObject({
      code: 'duplicate_registration',
    });

    expect(created).toEqual([]);
  });

  it('accepts a duplicate with a warning when the policy is warn', async () => {
    const { service } = harness({
      existingPerson: personRow(),
      duplicate: { id: 'registration-0', reference: 'EP-ZZZZZZ' },
      settings: { approvalMode: 'manual', duplicatePolicy: 'warn' },
    });

    const receipt = await service.submit('village-2026', input(), null);

    expect(receipt.duplicate).toBe(true);
  });

  it('reports an unknown event slug as not found', async () => {
    const { service } = harness({ target: null });

    await expect(service.submit('missing', input(), null)).rejects.toMatchObject({
      code: 'not_found',
    });
  });

  it('refuses a category that is not available', async () => {
    const { service } = harness({
      existingPerson: personRow(),
      categoryAvailable: false,
    });

    await expect(
      service.submit('village-2026', input({ categoryKey: 'startup' }), null),
    ).rejects.toMatchObject({ code: 'invalid_category' });
  });
});

describe('submission answer mapping', () => {
  it('does not store a blank optional answer', async () => {
    const { service, created } = harness({
      existingPerson: personRow(),
      fields: [field({ required: false, key: 'comments' })],
    });

    await service.submit(
      'village-2026',
      input({ answers: [{ fieldKey: 'comments', value: '   ' }] }),
      null,
    );

    expect(created[0].answers).toEqual([]);
  });
});
