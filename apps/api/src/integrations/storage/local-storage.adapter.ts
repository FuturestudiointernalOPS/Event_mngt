import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import type { Env } from '../../config/env.validation';
import { StorageObjectInput, StoragePort } from './storage.port';

/**
 * Local-disk storage: uploads are written under one directory and served by the API at
 * `/static/...`.
 *
 * This is the development and single-server default. It is not shared between processes,
 * so a multi-instance deployment must move to an object store before scaling out.
 *
 * Keys are built server-side from a tenant id, a fixed name and a content hash, never from
 * user input. The path check below is defence in depth: a key can never escape the root.
 */
@Injectable()
export class LocalStorageAdapter implements StoragePort {
  constructor(private readonly config: ConfigService<Env, true>) {}

  async upload(input: StorageObjectInput): Promise<{ key: string; url: string }> {
    const path = this.pathFor(input.key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, input.body);
    return { key: input.key, url: this.publicUrl(input.key) };
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }

  publicUrl(key: string): string {
    const base = this.config.get('PUBLIC_API_URL', { infer: true }).replace(/\/+$/, '');
    return `${base}/static/${key}`;
  }

  private root(): string {
    return resolve(process.cwd(), this.config.get('LOCAL_STORAGE_DIR', { infer: true }));
  }

  private pathFor(key: string): string {
    const root = this.root();
    const path = resolve(join(root, key));

    if (!path.startsWith(`${root}${sep}`)) {
      throw new Error(`Refusing to touch a file outside the storage directory: ${key}`);
    }

    return path;
  }
}
