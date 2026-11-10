import type {
  RegistrationField,
  SubmitRegistrationRequest,
} from '@event-platform/shared';
import type {
  TenantPrismaClient,
  TenantTransactionService,
} from '../../src/database/tenant-transaction.service';
import {
  EventStatus,
  EventVisibility,
  RegistrationSource,
  RegistrationStatus,
  type Person,
} from '../../src/database/prisma-client';
import type {
  BadgesService,
  IssuedBadgeNotice,
} from '../../src/modules/badges/badges.service';
import type { CategoriesService } from '../../src/modules/registration-forms/categories.service';
import type { RegistrationFormService } from '../../src/modules/registration-forms/registration-form.service';
import type { ConsentService } from '../../src/modules/consent/consent.service';
import type {
  EventsService,
  PublicEventTarget,
} from '../../src/modules/events/events.service';
import type { ModuleRegistryService } from '../../src/modules/module-registry/module-registry.service';
import { RegistrationSubmissionService } from '../../src/modules/registrations/registration-submission.service';
import type { RegistrationsRepository } from '../../src/modules/registrations/registrations.repository';
import type { RegistrationWithPerson } from '../../src/modules/registrations/registrations.mapper';

/**
 * Fixtures for the public submission spec. Kept outside `src` so the file-size rule is
 * about production code, and so two spec files could share it without duplicating fakes.
 */

const TX = {} as TenantPrismaClient;

export const TARGET: PublicEventTarget = {
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

export function field(
  overrides: Partial<RegistrationField> = {},
): RegistrationField {
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

export function input(
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

export interface HarnessOptions {
  target?: PublicEventTarget | null;
  settings?: Record<string, unknown>;
  existingPerson?: Person | null;
  duplicate?: { id: string; reference: string } | null;
  fields?: RegistrationField[];
  categoryAvailable?: boolean;
}

export function createSubmissionHarness(options: HarnessOptions = {}) {
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
      const notice: IssuedBadgeNotice = {
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
      };
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
