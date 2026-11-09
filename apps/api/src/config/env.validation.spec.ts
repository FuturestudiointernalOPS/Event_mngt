import { describe, expect, it } from 'vitest';
import { envSchema } from './env.validation';

const base = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  JWT_ACCESS_SECRET: 'x'.repeat(40),
};

describe('environment contract', () => {
  it('accepts the development defaults', () => {
    expect(envSchema.safeParse(base).success).toBe(true);
  });

  it('refuses to boot with the Resend provider but no API key', () => {
    const result = envSchema.safeParse({ ...base, EMAIL_PROVIDER: 'resend' });

    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain('RESEND_API_KEY');
  });

  it('lists every missing S3 setting at once', () => {
    const result = envSchema.safeParse({ ...base, STORAGE_PROVIDER: 's3' });
    const paths = result.error?.issues.map((i) => i.path[0]);

    expect(paths).toEqual(expect.arrayContaining(['S3_BUCKET', 'S3_REGION', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'S3_PUBLIC_BASE_URL']));
  });

  it('accepts a fully configured S3 provider', () => {
    const result = envSchema.safeParse({
      ...base, STORAGE_PROVIDER: 's3', S3_BUCKET: 'b', S3_REGION: 'eu-west-1',
      S3_ACCESS_KEY_ID: 'k', S3_SECRET_ACCESS_KEY: 's', S3_PUBLIC_BASE_URL: 'https://cdn.example.com',
    });

    expect(result.success).toBe(true);
  });
});
