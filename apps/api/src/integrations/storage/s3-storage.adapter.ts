import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { StorageObjectInput, StoragePort } from './storage.port';

/** The slice of the AWS client this adapter uses, so tests can substitute it. */
export interface S3Like {
  send(command: PutObjectCommand | DeleteObjectCommand): Promise<unknown>;
}

/**
 * S3-compatible object storage (AWS S3, Scaleway, Cloudflare R2, MinIO...). Objects are
 * served from `publicBase` (the bucket's public URL or a CDN in front of it); the adapter
 * never makes an object public itself, so access is governed by the bucket/CDN policy.
 */
@Injectable()
export class S3StorageAdapter implements StoragePort {
  constructor(
    private readonly client: S3Like,
    private readonly bucket: string,
    private readonly publicBase: string,
  ) {}

  async upload(input: StorageObjectInput): Promise<{ key: string; url: string }> {
    this.assertSafeKey(input.key);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
        // Uploaded branding is content-addressed by a random suffix, so it never changes.
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
    return { key: input.key, url: this.publicUrl(input.key) };
  }

  async delete(key: string): Promise<void> {
    this.assertSafeKey(key);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  publicUrl(key: string): string {
    return `${this.publicBase.replace(/\/+$/, '')}/${key.split('/').map(encodeURIComponent).join('/')}`;
  }

  private assertSafeKey(key: string): void {
    if (key.startsWith('/') || key.split('/').includes('..') || key.length === 0) {
      throw new Error('Invalid storage key');
    }
  }
}
