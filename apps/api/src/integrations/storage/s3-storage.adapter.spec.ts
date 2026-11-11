import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { describe, expect, it, vi } from 'vitest';
import { S3StorageAdapter } from './s3-storage.adapter';

describe('S3StorageAdapter', () => {
  const make = () => {
    const send = vi.fn().mockResolvedValue({});
    return { send, adapter: new S3StorageAdapter({ send }, 'assets', 'https://cdn.example.com/') };
  };

  it('uploads with the content type and returns the public URL', async () => {
    const { send, adapter } = make();
    const stored = await adapter.upload({ key: 'org/branding/logo-ab12.png', contentType: 'image/png', body: Buffer.from('x') });

    expect(stored.url).toBe('https://cdn.example.com/org/branding/logo-ab12.png');
    const command = send.mock.calls[0][0] as PutObjectCommand;
    expect(command.input).toMatchObject({ Bucket: 'assets', Key: 'org/branding/logo-ab12.png', ContentType: 'image/png' });
  });

  it('deletes by key', async () => {
    const { send, adapter } = make();
    await adapter.delete('org/a.png');

    expect((send.mock.calls[0][0] as DeleteObjectCommand).input).toMatchObject({ Bucket: 'assets', Key: 'org/a.png' });
  });

  it('refuses keys that could escape the prefix', async () => {
    const { adapter } = make();

    await expect(adapter.upload({ key: '../x', contentType: 'image/png', body: Buffer.from('x') })).rejects.toThrow();
    await expect(adapter.upload({ key: '/abs', contentType: 'image/png', body: Buffer.from('x') })).rejects.toThrow();
  });

  it('encodes unusual characters in public URLs', () => {
    expect(make().adapter.publicUrl('org/my logo.png')).toBe('https://cdn.example.com/org/my%20logo.png');
  });
});
