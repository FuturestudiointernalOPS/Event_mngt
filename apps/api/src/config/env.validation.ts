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

  /**
   * Runtime connection string. When set, the API connects as this role instead of the
   * migration owner, which is what makes row-level security apply. Use the non-owner
   * `platform_app` role. Migrations keep using DATABASE_URL.
   */
  APP_DATABASE_URL: z.string().min(1).optional(),

  JWT_ACCESS_SECRET: z
    .string()
    .min(32, 'Use at least 32 characters — generate with: openssl rand -base64 48'),
  JWT_ACCESS_TTL: z.string().min(2).default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),

  COOKIE_DOMAIN: z.string().optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  /** Reverse-proxy hops trusted for the client address. 0 means direct connection. */
  TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(0),

  /** Idempotent replays are scoped to a caller and expire after this many hours. */
  IDEMPOTENCY_TTL_HOURS: z.coerce.number().int().min(1).max(168).default(24),

  /** Default fixed-window budget for routes annotated with @RateLimit(). */
  RATE_LIMIT_DEFAULT_LIMIT: z.coerce.number().int().min(1).max(10_000).default(20),
  RATE_LIMIT_DEFAULT_WINDOW_SECONDS: z.coerce.number().int().min(1).max(3_600).default(60),
  /** Old fixed-window rows are deleted after this many hours. */
  RATE_LIMIT_RETENTION_HOURS: z.coerce.number().int().min(1).max(720).default(48),

  /** Redis enables durable e-mail and export jobs. Without it those run in-process. */
  REDIS_URL: z.string().min(1).optional(),
  /** False on API-only instances when a separate worker consumes the queues. */
  JOBS_WORKER_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),

  EMAIL_PROVIDER: z.enum(['console', 'resend']).default('console'),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('no-reply@example.com'),

  STORAGE_PROVIDER: z.enum(['console', 's3']).default('console'),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  /** Public base URL of the bucket or its CDN, e.g. https://cdn.example.com (no trailing slash). */
  S3_PUBLIC_BASE_URL: z.string().url().optional(),
})
  // A provider that is selected but not configured must stop the boot with a clear
  // message, not fail later on the first e-mail or upload.
  .superRefine((env, ctx) => {
    const need = (value: unknown, path: string, message: string): void => {
      if (!value) ctx.addIssue({ code: 'custom', path: [path], message });
    };
    if (env.EMAIL_PROVIDER === 'resend') {
      need(env.RESEND_API_KEY, 'RESEND_API_KEY', 'Required when EMAIL_PROVIDER=resend');
    }
    if (env.STORAGE_PROVIDER === 's3') {
      for (const key of ['S3_BUCKET', 'S3_REGION', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'S3_PUBLIC_BASE_URL'] as const) {
        need(env[key], key, 'Required when STORAGE_PROVIDER=s3');
      }
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
