import { Injectable } from '@nestjs/common';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { StorageObjectInput, StoragePort } from './storage.port';

/**
 * Stores objects on local disk and serves them under /static. Meant for development and
 * single-node setups; an S3-compatible adapter replaces it behind the same port.
 */
@Injectable()
export class LocalStorageAdapter implements StoragePort {
  constructor(
    private readonly directory: string,
    private readonly publicBase: string,
  ) {}

  async upload(input: StorageObjectInput): Promise<{ key: string; url: string }> {
    const target = this.pathFor(input.key);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, input.body);
    return { key: input.key, url: this.publicUrl(input.key) };
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }

  publicUrl(key: string): string {
    return `${this.publicBase}/static/${key}`;
  }

  /** Refuses any key that would escape the storage directory. */
  private pathFor(key: string): string {
    const root = resolve(this.directory);
    const target = resolve(root, key);
    if (!target.startsWith(root + sep)) {
      throw new Error('Invalid storage key');
    }
    return target;
  }
}
