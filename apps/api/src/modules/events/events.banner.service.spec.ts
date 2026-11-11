import { describe, expect, it } from 'vitest';
import type { AuditService } from '../../common/audit/audit.service';
import type { TenantTransactionService } from '../../database/tenant-transaction.service';
import type { StoragePort } from '../../integrations/storage/storage.port';
import { EventBannerService } from './events.banner.service';
import type { EventWithModules } from './events.mapper';
import type { EventsRepository } from './events.repository';

const TENANT = { organizationId: 'org-1', userId: 'user-1' };
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

function eventRow(overrides: Partial<EventWithModules> = {}): EventWithModules {
  const now = new Date('2026-11-09T10:00:00.000Z');

  return {
    id: 'e1',
    organizationId: 'org-1',
    parentEventId: null,
    slug: 'village-2026',
    name: 'Village 2026',
    description: null,
    format: 'IN_PERSON',
    status: 'DRAFT',
    visibility: 'PRIVATE',
    timeZone: 'UTC',
    startsAt: now,
    endsAt: now,
    venueName: null,
    venueAddress: null,
    bannerUrl: null,
    brandPrimaryColor: null,
    brandSecondaryColor: null,
    brandAccentColor: null,
    registrationOpensAt: null,
    registrationClosesAt: null,
    publishedAt: null,
    createdByUserId: 'user-1',
    createdAt: now,
    updatedAt: now,
    modules: [],
    ...overrides,
  } as EventWithModules;
}

function build(options: { eventExists?: boolean } = {}) {
  const eventExists = options.eventExists ?? true;
  const uploads: { key: string; contentType: string; body: Buffer }[] = [];
  const updates: Record<string, unknown>[] = [];
  const audits: unknown[] = [];

  const repository = {
    findStatus: async () =>
      eventExists ? { id: 'e1', status: 'DRAFT', visibility: 'PRIVATE' } : null,
    update: async (_tx: unknown, _eventId: string, data: Record<string, unknown>) => {
      updates.push(data);
      return eventRow(data as Partial<EventWithModules>);
    },
  } as unknown as EventsRepository;

  const tenantTransaction = {
    withTenant: async (callback: (tx: unknown, tenant: typeof TENANT) => Promise<unknown>) =>
      callback({}, TENANT),
  } as unknown as TenantTransactionService;

  const storage = {
    upload: async (input: { key: string; contentType: string; body: Buffer }) => {
      uploads.push(input);
      return { key: input.key, url: `https://cdn.example/${input.key}` };
    },
    delete: async () => undefined,
    publicUrl: (key: string) => `https://cdn.example/${key}`,
  } as StoragePort;

  const audit = {
    record: async (entry: unknown) => {
      audits.push(entry);
    },
  } as unknown as AuditService;

  return {
    service: new EventBannerService(tenantTransaction, repository, audit, storage),
    uploads,
    updates,
    audits,
  };
}

const image = { mimetype: 'image/png', size: png.length, buffer: png };

describe('EventBannerService', () => {
  it('stores the image under a tenant- and event-scoped key and saves the URL', async () => {
    const fakes = build();

    const detail = await fakes.service.upload('e1', image);
    const key = fakes.uploads[0].key;

    expect(key).toMatch(/^org-1\/events\/e1\/banner-[0-9a-f]{16}\.png$/);
    expect(fakes.uploads[0].contentType).toBe('image/png');
    expect(fakes.updates[0]).toEqual({ bannerUrl: `https://cdn.example/${key}` });
    expect(detail.bannerUrl).toBe(`https://cdn.example/${key}`);
  });

  it('refuses a file that is not an allowed image, before touching storage', async () => {
    const fakes = build();

    await expect(
      fakes.service.upload('e1', { mimetype: 'image/svg+xml', size: 9, buffer: Buffer.from('<svg/>') }),
    ).rejects.toMatchObject({ code: 'file_type_not_allowed' });

    expect(fakes.uploads).toHaveLength(0);
    expect(fakes.updates).toHaveLength(0);
  });

  it('reports an unknown or foreign event as not found without uploading', async () => {
    const fakes = build({ eventExists: false });

    await expect(fakes.service.upload('e1', image)).rejects.toMatchObject({ code: 'not_found' });

    expect(fakes.uploads).toHaveLength(0);
    expect(fakes.audits).toHaveLength(0);
  });

  it('records the change in the audit log', async () => {
    const fakes = build();

    await fakes.service.upload('e1', image);

    expect(fakes.audits[0]).toMatchObject({
      action: 'event.updated',
      targetType: 'event',
      targetId: 'e1',
      metadata: { asset: 'banner' },
    });
  });
});
