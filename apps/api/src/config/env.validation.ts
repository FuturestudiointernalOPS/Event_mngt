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

  EMAIL_PROVIDER: z.enum(['console', 'resend', 'ses']).default('console'),
  EMAIL_FROM: z.string().default('no-reply@example.com'),

  STORAGE_PROVIDER: z.enum(['console', 's3']).default('console'),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
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
