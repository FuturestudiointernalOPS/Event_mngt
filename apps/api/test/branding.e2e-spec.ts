import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { baseUrl, call, e2eEnabled, ownerClient, signUp } from './helpers/http';

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

async function upload(path: string, token: string, bytes: Uint8Array, name = 'logo.png') {
  const form = new FormData();
  form.append('file', new Blob([bytes]), name);
  const response = await fetch(`${baseUrl}/api/v1${path}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: form,
  });
  const json = (await response.json()) as { data?: any; error?: { code: string } };
  return { status: response.status, data: json.data, error: json.error };
}

describe.skipIf(!e2eEnabled)('journey: branding assets', () => {
  const owner = ownerClient();
  const tag = `b${Date.now()}`;
  const slug = `${tag}-org`;
  let admin = { token: '', userId: '' };
  let viewer = { token: '', userId: '' };

  beforeAll(async () => {
    admin = await signUp(owner, `${tag}-admin@example.test`);
    viewer = await signUp(owner, `${tag}-viewer@example.test`);
    await call('POST', '/organizations', { token: admin.token, body: { name: 'Brand Org', slug } });
  });

  afterAll(async () => {
    await owner.organization.deleteMany({ where: { slug: { startsWith: tag } } });
    await owner.user.deleteMany({ where: { email: { startsWith: tag } } });
    await owner.$disconnect();
  });

  it('stores a real image and publishes its URL in the branding', async () => {
    const reply = await upload(`/workspaces/${slug}/branding/assets/logo`, admin.token, PNG);
    expect(reply.status).toBe(201);
    expect(reply.data.branding.logoUrl).toMatch(/\/static\/.+\/branding\/logo-.+\.png$/);

    const file = await fetch(reply.data.branding.logoUrl);
    expect(file.status).toBe(200);
    expect(file.headers.get('content-type')).toContain('image/png');
  });

  it('rejects SVG and scripts even when named like an image', async () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    const reply = await upload(`/workspaces/${slug}/branding/assets/logo`, admin.token, svg, 'logo.png');
    expect(reply.status).toBe(422);
    expect(reply.error?.code).toBe('unsupported_image');
  });

  it('rejects files over the size limit', async () => {
    const big = new Uint8Array(1_200_000);
    big.set(PNG);
    expect((await upload(`/workspaces/${slug}/branding/assets/logo`, admin.token, big)).status).toBe(413);
  });

  it('rejects an unknown asset kind', async () => {
    expect((await upload(`/workspaces/${slug}/branding/assets/banner`, admin.token, PNG)).error?.code).toBe('invalid_asset_kind');
  });

  it('is closed to someone without workspace permission', async () => {
    expect((await upload(`/workspaces/${slug}/branding/assets/logo`, viewer.token, PNG)).status).toBe(403);
  });
});
