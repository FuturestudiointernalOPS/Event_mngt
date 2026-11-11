import { describe, expect, it } from 'vitest';
import { AppException } from '../../common/app-exception';
import type { TenantPrismaClient, TenantTransactionService } from '../../database/tenant-transaction.service';
import type { ConsentDocument as ConsentDocumentRow } from '../../database/prisma-client';
import type { ConsentRepository } from './consent.repository';
import { ConsentService } from './consent.service';
import type { ConsentRequirementRecord } from './consent.versions';

const REQUIREMENTS: ConsentRequirementRecord[] = [
  {
    id: 'document-privacy',
    key: 'privacy',
    version: 2,
    title: 'Privacy',
    body: 'Text',
    required: true,
  },
  {
    id: 'document-photos',
    key: 'photos',
    version: 1,
    title: 'Photos',
    body: 'Text',
    required: false,
  },
];

const TX = {} as TenantPrismaClient;

interface Harness {
  service: ConsentService;
  written: Array<Record<string, unknown>>;
}

function harness(): Harness {
  const written: Array<Record<string, unknown>> = [];

  const repository = {
    createRecord: async (_tx: unknown, data: Record<string, unknown>) => {
      written.push(data);
    },
  } as unknown as ConsentRepository;

  return {
    service: new ConsentService({} as TenantTransactionService, repository),
    written,
  };
}

describe('consent acceptance', () => {
  it('writes one record for a required acceptance at the current version', async () => {
    const { service, written } = harness();

    await service.recordAcceptances(TX, {
      organizationId: 'org-1',
      registrationId: 'registration-1',
      requirements: REQUIREMENTS,
      accepted: [{ key: 'privacy', version: 2 }],
      ipAddress: '203.0.113.9',
    });

    expect(written).toHaveLength(1);
    expect(written[0]).toMatchObject({
      organizationId: 'org-1',
      registrationId: 'registration-1',
      documentId: 'document-privacy',
      documentKey: 'privacy',
      documentVersion: 2,
      ipAddress: '203.0.113.9',
    });
  });

  it('refuses when a required document was not accepted', async () => {
    const { service, written } = harness();

    await expect(
      service.recordAcceptances(TX, {
        organizationId: 'org-1',
        registrationId: 'registration-1',
        requirements: REQUIREMENTS,
        accepted: [],
      }),
    ).rejects.toMatchObject({ code: 'consent_required' });

    expect(written).toEqual([]);
  });

  it('refuses an acceptance of an older version', async () => {
    const { service } = harness();

    await expect(
      service.recordAcceptances(TX, {
        organizationId: 'org-1',
        registrationId: 'registration-1',
        requirements: REQUIREMENTS,
        accepted: [{ key: 'privacy', version: 1 }],
      }),
    ).rejects.toBeInstanceOf(AppException);
  });

  it('records an optional acceptance and ignores unknown keys', async () => {
    const { service, written } = harness();

    await service.recordAcceptances(TX, {
      organizationId: 'org-1',
      registrationId: 'registration-1',
      requirements: REQUIREMENTS,
      accepted: [
        { key: 'privacy', version: 2 },
        { key: 'photos', version: 1 },
        { key: 'not-asked', version: 7 },
      ],
    });

    expect(written.map((row) => row.documentKey)).toEqual(['privacy', 'photos']);
  });
});

describe('consent document creation', () => {
  function creatingService(existingVersion: number | null) {
    const created: Array<Record<string, unknown>> = [];

    const repository = {
      eventExists: async () => ({ id: 'event-1' }),
      latestVersion: async () => (existingVersion === null ? null : { version: existingVersion }),
      create: async (_tx: unknown, data: Record<string, unknown>) => {
        created.push(data);
        return {
          id: 'new-document',
          ...data,
          updatedAt: new Date(),
          createdAt: new Date(),
        } as ConsentDocumentRow;
      },
    } as unknown as ConsentRepository;

    const tenantTransaction = {
      withTenant: async (
        callback: (tx: TenantPrismaClient, tenant: { organizationId: string }) => unknown,
      ) => callback(TX, { organizationId: 'org-1' }),
    } as unknown as TenantTransactionService;

    return { service: new ConsentService(tenantTransaction, repository), created };
  }

  it('starts at version 1 for a new key', async () => {
    const { service, created } = creatingService(null);

    const document = await service.createDocument('event-1', {
      key: 'privacy',
      title: 'Privacy',
      body: 'Text',
      required: true,
      publish: true,
    });

    expect(created[0].version).toBe(1);
    expect(document.publishedAt).not.toBeNull();
  });

  it('increments the version of an existing key', async () => {
    const { service } = creatingService(4);

    const document = await service.createDocument('event-1', {
      key: 'privacy',
      title: 'Privacy',
      body: 'Text',
      required: true,
      publish: false,
    });

    expect(document.version).toBe(5);
    expect(document.publishedAt).toBeNull();
  });
});
