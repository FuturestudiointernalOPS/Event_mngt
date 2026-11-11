import { describe, expect, it } from 'vitest';
import type { TenantPrismaClient, TenantTransactionService } from '../../database/tenant-transaction.service';
import type { ConsentService } from '../consent/consent.service';
import type { EventsService } from '../events/events.service';
import type { ModuleRegistryService } from '../module-registry/module-registry.service';
import { PublicRegistrationFormService } from './public-registration-form.service';
import type {
  FormWithFields,
  RegistrationFormsRepository,
} from './registration-forms.repository';

const TX = {} as TenantPrismaClient;

const TARGET = {
  id: 'event-1',
  organizationId: 'org-1',
  slug: 'village-2026',
  name: 'Village 2026',
  status: 'PUBLISHED',
  visibility: 'PUBLIC',
  registrationOpensAt: null,
  registrationClosesAt: null,
};

function formRow(): FormWithFields {
  return {
    id: 'form-1',
    organizationId: 'org-1',
    eventId: 'event-1',
    title: 'Registration',
    description: null,
    version: 3,
    createdAt: new Date(),
    updatedAt: new Date(),
    fields: [
      {
        id: 'field-1',
        organizationId: 'org-1',
        formId: 'form-1',
        key: 'motivation',
        label: 'Motivation',
        type: 'TEXTAREA',
        required: true,
        placeholder: null,
        helpText: null,
        options: null,
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  };
}

function harness(options: { target?: typeof TARGET | null; settings?: Record<string, unknown> } = {}) {
  const target = options.target === undefined ? TARGET : options.target;

  const repository = {
    listPublicCategories: async () => [
      { key: 'startup', name: 'Startup', description: null },
    ],
    findForm: async () => formRow(),
  } as unknown as RegistrationFormsRepository;

  const events = {
    findPublicTarget: async () => target,
  } as unknown as EventsService;

  const modules = {
    requireEnabledSettings: async () =>
      options.settings ?? { duplicatePolicy: 'block', approvalMode: 'automatic' },
  } as unknown as ModuleRegistryService;

  const consent = {
    requirementsFor: async () => [
      {
        id: 'document-1',
        key: 'privacy',
        version: 2,
        title: 'Privacy',
        body: 'Text',
        required: true,
      },
    ],
  } as unknown as ConsentService;

  const tenantTransaction = {
    withOrganizationScope: async (
      _organizationId: string,
      callback: (tx: TenantPrismaClient) => unknown,
    ) => callback(TX),
  } as unknown as TenantTransactionService;

  return new PublicRegistrationFormService(
    tenantTransaction,
    repository,
    events,
    modules,
    consent,
  );
}

describe('public registration form', () => {
  it('projects categories, fields, consents and settings', async () => {
    const form = await harness().get('village-2026');

    expect(form.event).toEqual({ slug: 'village-2026', name: 'Village 2026' });
    expect(form.categories).toEqual([
      { key: 'startup', name: 'Startup', description: null },
    ]);
    expect(form.form?.version).toBe(3);
    expect(form.form?.fields[0].key).toBe('motivation');
    expect(form.window.isOpen).toBe(true);
    expect(form.duplicatePolicy).toBe('block');
    expect(form.approvalMode).toBe('automatic');
  });

  it('drops the internal document id from the public consent list', async () => {
    const form = await harness().get('village-2026');

    expect(form.consentDocuments).toEqual([
      {
        key: 'privacy',
        version: 2,
        title: 'Privacy',
        body: 'Text',
        required: true,
      },
    ]);
  });

  it('falls back to safe module defaults', async () => {
    const form = await harness({ settings: {} }).get('village-2026');

    expect(form.duplicatePolicy).toBe('warn');
    expect(form.approvalMode).toBe('manual');
  });

  it('reports an unknown event as not found', async () => {
    await expect(
      harness({ target: null }).get('missing-event'),
    ).rejects.toMatchObject({ code: 'not_found' });
  });
});
