import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaClient } from '../src/database/prisma-client';
import {
  api,
  createE2EFixtures,
  createOwnerClient,
  destroyE2EFixtures,
  e2eEnabled,
  expectData,
  login,
  type E2EFixtures,
} from './support/e2e-harness';

/**
 * The main public journey over HTTP (WP-21): configure, register, approve, badge,
 * check in, report.
 *
 * The manual check-in path is used deliberately: the badge token is never retrievable,
 * so the staff fallback is the only route a test can drive without a mailbox.
 */

interface EventDetail {
  id: string;
  slug: string;
  status: string;
}

interface Category {
  id: string;
  key: string;
}

interface PublicForm {
  categories: Array<{ key: string }>;
  form: { fields: Array<{ key: string }> } | null;
  consentDocuments: Array<{ key: string; version: number }>;
  window: { isOpen: boolean };
}

interface RegistrationReceipt {
  reference: string;
  status: string;
  duplicate: boolean;
  requiresApproval: boolean;
  badgeIssued: boolean;
}

interface RegistrationDetail {
  id: string;
  reference: string;
  status: string;
  badge: { status: string } | null;
}


interface CheckIn {
  id: string;
  reference: string;
  duplicate: boolean;
}

interface CheckInSummary {
  total: number;
  byCategory: Array<{ key: string; checkedIn: number }>;
}

interface EventReport {
  registrations: {
    total: number;
    byStatus: Record<string, number>;
  };
  badges: { issued: number; revoked: number };
}

describe.skipIf(!e2eEnabled)('registration to check-in (HTTP journey)', () => {
  let owner: PrismaClient;
  let fixtures: E2EFixtures;
  let token: string;
  let eventId = '';
  const eventSlug = `e2e-registration-${Date.now().toString(36)}`;
  const personEmail = `amina-${Date.now().toString(36)}@example.test`;
  let registrationId = '';
  let reference = '';

  beforeAll(async () => {
    owner = createOwnerClient();
    fixtures = await createE2EFixtures(owner);
    token = await login(fixtures.adminEmail, fixtures.adminPassword);

    const startsAt = new Date(Date.now() + 86_400_000);
    const endsAt = new Date(startsAt.getTime() + 7_200_000);

    const created = await api<EventDetail>(
      'POST',
      `/workspaces/${fixtures.slug}/events`,
      {
        token,
        body: {
          name: 'Registration journey event',
          slug: eventSlug,
          format: 'IN_PERSON',
          visibility: 'PUBLIC',
          timeZone: 'UTC',
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
        },
      },
    );
    eventId = expectData(created, 'create event').id;

    const modules = await api(
      'PATCH',
      `/workspaces/${fixtures.slug}/events/${eventId}/modules`,
      {
        token,
        body: {
          modules: [
            {
              key: 'registration',
              enabled: true,
              settings: {
                approvalMode: 'manual',
                requiresConsent: true,
                duplicatePolicy: 'warn',
              },
            },
            { key: 'checkin', enabled: true },
          ],
        },
      },
    );
    expect(modules.status).toBe(200);

    const category = await api<Category>(
      'POST',
      `/workspaces/${fixtures.slug}/events/${eventId}/categories`,
      { token, body: { key: 'startup', name: 'Startup' } },
    );
    expect(category.status).toBe(201);

    const form = await api(
      'PUT',
      `/workspaces/${fixtures.slug}/events/${eventId}/registration-form`,
      {
        token,
        body: {
          title: 'Registration',
          fields: [
            {
              key: 'motivation',
              label: 'Why do you want to join?',
              type: 'TEXT',
              required: true,
            },
          ],
        },
      },
    );
    expect(form.status).toBe(200);

    const consent = await api(
      'POST',
      `/workspaces/${fixtures.slug}/events/${eventId}/consent-documents`,
      {
        token,
        body: {
          key: 'privacy',
          title: 'Privacy notice',
          body: 'Your data is processed to manage this event.',
          required: true,
          publish: true,
        },
      },
    );
    expect(consent.status).toBe(201);

    const published = await api(
      'POST',
      `/workspaces/${fixtures.slug}/events/${eventId}/publish`,
      { token },
    );
    expect(published.status).toBe(201);
  }, 90_000);

  afterAll(async () => {
    if (fixtures) {
      await destroyE2EFixtures(owner, fixtures);
    }
    await owner?.$disconnect();
  }, 60_000);

  it('serves the public form with categories, fields and consent', async () => {
    const form = await api<PublicForm>(
      'GET',
      `/public/events/${eventSlug}/registration-form`,
    );

    expect(form.status).toBe(200);
    expect(form.data?.categories.map((category) => category.key)).toContain('startup');
    expect(form.data?.form?.fields.map((field) => field.key)).toContain('motivation');
    expect(form.data?.consentDocuments.map((document) => document.key)).toContain(
      'privacy',
    );
    expect(form.data?.window.isOpen).toBe(true);
  });

  it('accepts a public submission that waits for approval', async () => {
    const submitted = await api<RegistrationReceipt>(
      'POST',
      `/public/events/${eventSlug}/registrations`,
      {
        body: {
          email: personEmail,
          firstName: 'Amina',
          lastName: 'Dossou',
          categoryKey: 'startup',
          answers: [{ fieldKey: 'motivation', value: 'I build climate sensors.' }],
          consents: [{ key: 'privacy', version: 1, accepted: true }],
        },
      },
    );

    expect(submitted.status).toBe(201);
    expect(submitted.data?.status).toBe('PENDING');
    expect(submitted.data?.requiresApproval).toBe(true);
    expect(submitted.data?.badgeIssued).toBe(false);
    reference = expectData(submitted, 'submit registration').reference;
  });

  it('approves the registration and issues a badge', async () => {
    const page = await api<RegistrationDetail[]>(
      'GET',
      `/workspaces/${fixtures.slug}/events/${eventId}/registrations?search=${encodeURIComponent(personEmail)}`,
      { token },
    );

    expect(page.status).toBe(200);
    const registration = page.data?.find((item) => item.reference === reference);
    expect(registration).toBeDefined();
    registrationId = registration!.id;

    const approved = await api<RegistrationDetail>(
      'POST',
      `/workspaces/${fixtures.slug}/events/${eventId}/registrations/${registrationId}/approve`,
      { token, body: {} },
    );

    expect(approved.status).toBe(201);
    expect(approved.data?.status).toBe('APPROVED');
    expect(approved.data?.badge?.status).toBe('ISSUED');
  });

  it('checks the person in once and reports the repeat as a duplicate', async () => {
    const first = await api<CheckIn>(
      'POST',
      `/workspaces/${fixtures.slug}/events/${eventId}/check-ins`,
      {
        token,
        body: { registrationId, scannedAt: new Date().toISOString() },
      },
    );

    expect(first.status).toBe(201);
    expect(first.data?.duplicate).toBe(false);

    const repeat = await api<CheckIn>(
      'POST',
      `/workspaces/${fixtures.slug}/events/${eventId}/check-ins`,
      {
        token,
        body: { registrationId, scannedAt: new Date().toISOString() },
      },
    );

    expect(repeat.status).toBe(201);
    expect(repeat.data?.duplicate).toBe(true);
  });

  it('reflects the attendance in the summary and the event report', async () => {
    const summary = await api<CheckInSummary>(
      'GET',
      `/workspaces/${fixtures.slug}/events/${eventId}/check-ins/summary`,
      { token },
    );

    expect(summary.status).toBe(200);
    expect(summary.data?.total).toBe(1);
    expect(summary.data?.byCategory).toEqual(
      expect.arrayContaining([{ key: 'startup', name: 'Startup', checkedIn: 1 }]),
    );

    const report = await api<EventReport>(
      'GET',
      `/workspaces/${fixtures.slug}/events/${eventId}/reports/summary`,
      { token },
    );

    expect(report.status).toBe(200);
    expect(report.data?.registrations.total).toBe(1);
    expect(report.data?.registrations.byStatus.APPROVED).toBe(1);
    expect(report.data?.badges.issued).toBe(1);
  });
});
