import { describe, expect, it } from 'vitest';
import type { WorkspaceBranding } from '../../database/prisma-client';
import { DEFAULT_BRANDING } from '@event-platform/shared';
import type { AuditService } from '../../common/audit/audit.service';
import type { TenantContextService } from '../../database/tenant-context.service';
import type { TenantTransactionService } from '../../database/tenant-transaction.service';
import type { StorageObjectInput, StoragePort } from '../../integrations/storage/storage.port';
import { BrandingAssetsService } from './branding-assets.service';

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01]);
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x01]);

function pngFile() {
  return { mimetype: 'image/png', size: png.length, buffer: png };
}

interface Harness {
  service: BrandingAssetsService;
  uploads: StorageObjectInput[];
  audits: number;
  branding: () => WorkspaceBranding | null;
}

function build(): Harness {
  let row: WorkspaceBranding | null = null;
  const uploads: StorageObjectInput[] = [];
  const harness: Harness = {
    service: undefined as unknown as BrandingAssetsService,
    uploads,
    audits: 0,
    branding: () => row,
  };

  const storage = {
    upload: async (input: StorageObjectInput) => {
      uploads.push(input);
      return { key: input.key, url: `https://cdn.example.test/${input.key}` };
    },
    delete: async () => undefined,
    publicUrl: (key: string) => `https://cdn.example.test/${key}`,
  } as StoragePort;

  const tx = {
    workspaceBranding: {
      findUnique: async () => row,
      upsert: async ({ create, update }: { create: Record<string, unknown>; update: Record<string, unknown> }) => {
        row = row
          ? ({ ...row, ...update } as WorkspaceBranding)
          : ({ id: 'branding-1', updatedAt: new Date(), ...create } as unknown as WorkspaceBranding);
      },
    },
  };

  const tenantTransaction = {
    withTenant: async (callback: (client: unknown, tenant: unknown) => Promise<unknown>) =>
      callback(tx, { organizationId: 'org-1', userId: 'user-1' }),
  } as unknown as TenantTransactionService;

  const tenantContext = {
    getOrThrow: () => ({ organizationId: 'org-1', userId: 'user-1' }),
  } as unknown as TenantContextService;

  const audit = {
    record: async () => {
      harness.audits += 1;
    },
  } as unknown as AuditService;

  harness.service = new BrandingAssetsService(
    tenantTransaction,
    tenantContext,
    audit,
    storage,
  );

  return harness;
}

describe('BrandingAssetsService', () => {
  it('uploads to a content-addressed key and persists the URL', async () => {
    const harness = build();

    const result = await harness.service.upload('logo', pngFile());

    expect(harness.uploads).toHaveLength(1);
    expect(harness.uploads[0].key).toMatch(/^org-1\/branding\/logo-[0-9a-f]{16}\.png$/);
    expect(harness.uploads[0].contentType).toBe('image/png');
    expect(result.url).toBe(`https://cdn.example.test/${harness.uploads[0].key}`);
    expect(result.branding.logoUrl).toBe(result.url);
    expect(result.contrastWarnings).toEqual([]);
    expect(harness.audits).toBe(1);
  });

  it('re-uploading the same bytes reuses the key; a different file does not', async () => {
    const harness = build();

    await harness.service.upload('logo', pngFile());
    await harness.service.upload('logo', pngFile());
    await harness.service.upload('favicon', {
      mimetype: 'image/jpeg',
      size: jpeg.length,
      buffer: jpeg,
    });

    expect(harness.uploads[0].key).toBe(harness.uploads[1].key);
    expect(harness.uploads[2].key).not.toBe(harness.uploads[0].key);
    expect(harness.branding()?.faviconUrl).toContain('favicon-');
    expect(harness.branding()?.logoUrl).toContain('logo-');
  });

  it('starts from the default palette when no branding row exists', async () => {
    const harness = build();

    const result = await harness.service.upload('logoDark', pngFile());

    expect(result.branding.primaryColor).toBe(DEFAULT_BRANDING.primaryColor);
    expect(result.branding.logoDarkUrl).toBe(result.url);
  });
});
