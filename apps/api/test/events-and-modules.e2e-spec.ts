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
 * Event creation, module activation and publishing over HTTP (WP-21).
 *
 * The journey ends on the public page because that is the observable result: a draft
 * becomes a shareable event whose modules were validated on the way.
 */

interface EventDetail {
  id: string;
  slug: string;
  name: string;
  status: string;
  visibility: string;
  enabledModules: string[];
}

interface EventModule {
  key: string;
  enabled: boolean;
  settings: unknown;
}

interface PublicEventContext {
  event: { slug: string; name: string; visibility: string };
  organization: { slug: string; name: string };
  branding: { primaryColor: string };
}

describe.skipIf(!e2eEnabled)('events and modules (HTTP journey)', () => {
  let owner: PrismaClient;
  let fixtures: E2EFixtures;
  let token: string;
  let eventId: string;
  const eventSlug = `e2e-event-${Date.now().toString(36)}`;

  beforeAll(async () => {
    owner = createOwnerClient();
    fixtures = await createE2EFixtures(owner);
    token = await login(fixtures.adminEmail, fixtures.adminPassword);
  }, 60_000);

  afterAll(async () => {
    if (fixtures) {
      await destroyE2EFixtures(owner, fixtures);
    }
    await owner?.$disconnect();
  }, 60_000);

  it('creates a draft event with the initial modules', async () => {
    const startsAt = new Date(Date.now() + 86_400_000);
    const endsAt = new Date(startsAt.getTime() + 7_200_000);

    const created = await api<EventDetail>(
      'POST',
      `/workspaces/${fixtures.slug}/events`,
      {
        token,
        body: {
          name: 'End-to-end event',
          slug: eventSlug,
          format: 'IN_PERSON',
          visibility: 'PUBLIC',
          timeZone: 'UTC',
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
        },
      },
    );

    expect(created.status).toBe(201);
    const event = expectData(created, 'create event');

    expect(event.status).toBe('DRAFT');
    expect(event.enabledModules).toContain('core');
    eventId = event.id;

    const list = await api<EventDetail[]>(
      'GET',
      `/workspaces/${fixtures.slug}/events`,
      { token },
    );

    expect(list.data?.map((entry) => entry.id)).toContain(eventId);
  });

  it('enables dependent modules and refuses to remove the core', async () => {
    const updated = await api<EventModule[]>(
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

    expect(updated.status).toBe(200);
    expect(updated.data?.filter((module) => module.enabled).map((m) => m.key)).toEqual(
      expect.arrayContaining(['registration', 'checkin']),
    );

    const refused = await api(
      'PATCH',
      `/workspaces/${fixtures.slug}/events/${eventId}/modules`,
      { token, body: { modules: [{ key: 'core', enabled: false }] } },
    );

    expect(refused.status).toBe(422);
    expect(refused.error?.code).toBe('module_core_required');
  });

  it('publishes the event and serves its public page', async () => {
    const published = await api<EventDetail>(
      'POST',
      `/workspaces/${fixtures.slug}/events/${eventId}/publish`,
      { token },
    );

    expect(published.status).toBe(201);
    expect(published.data?.status).toBe('PUBLISHED');

    const context = await api<PublicEventContext>(
      'GET',
      `/public/events/${eventSlug}/context`,
    );

    expect(context.status).toBe(200);
    expect(context.data?.event.slug).toBe(eventSlug);
    expect(context.data?.organization.slug).toBe(fixtures.slug);
    expect(context.data?.branding.primaryColor).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
