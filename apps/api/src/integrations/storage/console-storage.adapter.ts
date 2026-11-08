import { Injectable, Logger } from '@nestjs/common';
import { StorageObjectInput, StoragePort } from './storage.port';

/**
 * Development adapter: records the upload instead of persisting it, and returns a
 * local placeholder URL so the branding editor remains usable offline.
 * A real S3-compatible adapter replaces this in Phase 2.
 */
@Injectable()
export class ConsoleStorageAdapter implements StoragePort {
  private readonly logger = new Logger(ConsoleStorageAdapter.name);

  async upload(input: StorageObjectInput): Promise<{ key: string; url: string }> {
    this.logger.log(
      `[storage:console] key=${input.key} contentType=${input.contentType} bytes=${input.body.byteLength}`,
    );
    return { key: input.key, url: this.publicUrl(input.key) };
  }

  async delete(key: string): Promise<void> {
    this.logger.log(`[storage:console] delete key=${key}`);
  }

  publicUrl(key: string): string {
    return `http://localhost:4000/static/${key}`;
  }
}
