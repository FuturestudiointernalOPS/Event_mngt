import { z } from 'zod';

/**
 * Environment contract. Boot fails fast, listing every problem at once, rather than
 * failing later with an obscure runtime error.
 *
 * See apps/api/.env.example for documentation of each value.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),

  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  WEB_APP_URL: z.url().default('http://localhost:5173'),

  /** Supabase PostgreSQL connection string. Database only — no Supabase services. */
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required (PostgreSQL connection string)'),

  JWT_ACCESS_SECRET: z
    .string()
    .min(32, 'Use at least 32 characters — generate with: openssl rand -base64 48'),
  JWT_ACCESS_TTL: z.string().min(2).default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),

  /** Signs QR badge codes. Falls back to a key derived from JWT_ACCESS_SECRET when unset. */
  BADGE_SIGNING_SECRET: z.string().min(32).optional(),

  /** Redis for background jobs (e-mail, retention). Unset = e-mail is sent inline, no scheduled jobs. */
  REDIS_URL: z.string().optional(),
  /** Run the job workers in this process. Set to "false" on pure API instances. */
  JOBS_WORKER_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  /** Number of reverse-proxy hops to trust for the client IP (0 = none). Needed for rate limits. */
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
  /** Set to "false" only in automated tests that send many requests from one address. */
  RATE_LIMIT_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),

  COOKIE_DOMAIN: z.string().optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  EMAIL_PROVIDER: z.enum(['console', 'resend']).default('console'),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('no-reply@example.com'),

  STORAGE_PROVIDER: z.enum(['console', 'local', 's3']).default('console'),
  /** Where the local storage adapter writes, and the public base URL it serves from. */
  STORAGE_LOCAL_DIR: z.string().default('./storage'),
  PUBLIC_API_URL: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  /** Public base URL of the bucket or its CDN, e.g. https://cdn.example.com (no trailing slash). */
  S3_PUBLIC_BASE_URL: z.string().url().optional(),
})
  // A provider that is selected but not configured must stop the boot with a clear message,
  // not fail later on the first e-mail or upload.
  .superRefine((env, ctx) => {
    const need = (ok: unknown, path: string, message: string): void => {
      if (!ok) ctx.addIssue({ code: 'custom', path: [path], message });
    };
    if (env.EMAIL_PROVIDER === 'resend') {
      need(env.RESEND_API_KEY, 'RESEND_API_KEY', 'Required when EMAIL_PROVIDER=resend');
    }
    if (env.STORAGE_PROVIDER === 's3') {
      need(env.S3_BUCKET, 'S3_BUCKET', 'Required when STORAGE_PROVIDER=s3');
      need(env.S3_REGION, 'S3_REGION', 'Required when STORAGE_PROVIDER=s3');
      need(env.S3_ACCESS_KEY_ID, 'S3_ACCESS_KEY_ID', 'Required when STORAGE_PROVIDER=s3');
      need(env.S3_SECRET_ACCESS_KEY, 'S3_SECRET_ACCESS_KEY', 'Required when STORAGE_PROVIDER=s3');
      need(env.S3_PUBLIC_BASE_URL, 'S3_PUBLIC_BASE_URL', 'Required when STORAGE_PROVIDER=s3');
    }
  });

export type Env = z.infer<typeof envSchema>;

/**
 * Passed to ConfigModule.forRoot({ validate }). Returning the parsed object means the
 * rest of the application reads coerced, defaulted values through ConfigService only.
 */
export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);

  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }

  return parsed.data;
}

export function parseCorsOrigins(value: string): string[] {
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}
