export interface StorageObjectInput {
  key: string;
  contentType: string;
  body: Buffer;
}

/**
 * Provider seam for object storage. Logos, banners and generated files live in an
 * S3-compatible bucket; the database stores only references and metadata.
 */
export interface StoragePort {
  upload(input: StorageObjectInput): Promise<{ key: string; url: string }>;
  delete(key: string): Promise<void>;
  publicUrl(key: string): string;
}

export const STORAGE_PORT = Symbol('STORAGE_PORT');
