import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { LocalStorageAdapter } from './local-storage.adapter';

describe('LocalStorageAdapter', () => {
  let dir = '';
  afterAll(async () => {
    if (dir) {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('stores an object and returns its public URL', async () => {
    dir = await mkdtemp(join(tmpdir(), 'storage-'));
    const adapter = new LocalStorageAdapter(dir, 'http://api.test');
    const stored = await adapter.upload({ key: 'org/branding/logo.png', contentType: 'image/png', body: Buffer.from('png') });

    expect(stored.url).toBe('http://api.test/static/org/branding/logo.png');
    expect((await readFile(join(dir, 'org/branding/logo.png'))).toString()).toBe('png');
  });

  it('refuses keys that escape the storage directory', async () => {
    dir = dir || (await mkdtemp(join(tmpdir(), 'storage-')));
    const adapter = new LocalStorageAdapter(dir, 'http://api.test');

    await expect(adapter.upload({ key: '../outside.txt', contentType: 'text/plain', body: Buffer.from('x') })).rejects.toThrow();
    await expect(adapter.upload({ key: '/etc/passwd', contentType: 'text/plain', body: Buffer.from('x') })).rejects.toThrow();
  });
});
