import type { ConfigService } from '@nestjs/config';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Env } from '../../config/env.validation';
import { LocalStorageAdapter } from './local-storage.adapter';

const body = Buffer.from('image-bytes');

let directory = '';
let adapter: LocalStorageAdapter;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'event-platform-storage-'));
  adapter = new LocalStorageAdapter({
    get: (key: keyof Env) =>
      key === 'LOCAL_STORAGE_DIR'
        ? directory
        : key === 'PUBLIC_API_URL'
          ? 'https://api.example.com/'
          : undefined,
  } as ConfigService<Env, true>);
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe('LocalStorageAdapter', () => {
  it('writes the bytes under the key and returns a servable URL', async () => {
    const result = await adapter.upload({
      key: 'org-1/events/e1/banner-abc.png',
      contentType: 'image/png',
      body,
    });

    expect(result.key).toBe('org-1/events/e1/banner-abc.png');
    expect(result.url).toBe('https://api.example.com/static/org-1/events/e1/banner-abc.png');
    await expect(readFile(join(directory, result.key), 'utf8')).resolves.toBe('image-bytes');
  });

  it('overwrites nothing else and deletes only the requested object', async () => {
    await adapter.upload({ key: 'org-1/logo-a.png', contentType: 'image/png', body });
    await adapter.upload({ key: 'org-1/logo-b.png', contentType: 'image/png', body });

    await adapter.delete('org-1/logo-a.png');

    await expect(stat(join(directory, 'org-1/logo-a.png'))).rejects.toThrow();
    await expect(stat(join(directory, 'org-1/logo-b.png'))).resolves.toBeTruthy();
  });

  it('deleting a key that does not exist is a no-op', async () => {
    await expect(adapter.delete('org-1/missing.png')).resolves.toBeUndefined();
  });

  it('refuses a key that would escape the storage directory', async () => {
    await expect(
      adapter.upload({ key: '../escaped.png', contentType: 'image/png', body }),
    ).rejects.toThrow(/outside the storage directory/);

    await expect(adapter.delete('../../etc/passwd')).rejects.toThrow(
      /outside the storage directory/,
    );
  });
});
