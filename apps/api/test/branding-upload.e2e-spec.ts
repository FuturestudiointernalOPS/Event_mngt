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
 * Workspace brand uploads over HTTP (WP-21).
 *
 * The console storage adapter is expected locally: the point is the allowlist, the
 * content-addressed key and the persistence of the returned URL, not the bucket.
 */

interface BrandingView {
  branding: {
    logoUrl: string | null;
    logoDarkUrl: string | null;
    faviconUrl: string | null;
  };
  contrastWarnings: unknown[];
}

interface UploadResult extends BrandingView {
  url: string;
  kind: string;
}

const PNG_SIGNATURE = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00,
]);

function imageForm(bytes: Uint8Array, type: string, name: string): FormData {
  const form = new FormData();
  form.append('file', new Blob([bytes], { type }), name);
  return form;
}

describe.skipIf(!e2eEnabled)('branding uploads (HTTP journey)', () => {
  let owner: PrismaClient;
  let fixtures: E2EFixtures;
  let token: string;

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

  it('starts from the workspace defaults', async () => {
    const branding = await api<BrandingView>(
      'GET',
      `/workspaces/${fixtures.slug}/branding`,
      { token },
    );

    expect(branding.status).toBe(200);
    expect(branding.data?.branding.logoUrl).toBeNull();
  });

  it('stores a PNG logo and returns the branding it produced', async () => {
    const uploaded = await api<UploadResult>(
      'POST',
      `/workspaces/${fixtures.slug}/branding/assets/logo`,
      { token, body: imageForm(PNG_SIGNATURE, 'image/png', 'logo.png') },
    );

    expect(uploaded.status).toBe(201);
    const result = expectData(uploaded, 'upload logo');

    expect(result.kind).toBe('logo');
    expect(result.branding.logoUrl).toBe(result.url);

    const branding = await api<BrandingView>(
      'GET',
      `/workspaces/${fixtures.slug}/branding`,
      { token },
    );

    expect(branding.data?.branding.logoUrl).toBe(result.url);
  });

  it('refuses content that only claims to be an image', async () => {
    const text = new TextEncoder().encode('this is not an image');

    const refused = await api(
      'POST',
      `/workspaces/${fixtures.slug}/branding/assets/favicon`,
      { token, body: imageForm(text, 'image/png', 'fake.png') },
    );

    expect(refused.status).toBe(422);
    expect(refused.error?.code).toBe('file_type_not_allowed');
  });
});
