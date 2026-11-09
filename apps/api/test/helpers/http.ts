import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/database/prisma-client';

/**
 * Helpers for the HTTP journey specs. They talk to a RUNNING API (E2E_BASE_URL) and use
 * the migration-owner connection only to seed what the public API cannot (marking an
 * e-mail verified, as clicking the link would). The suite is skipped when unset.
 */
export const baseUrl = process.env.E2E_BASE_URL;
export const ownerUrl = process.env.TEST_OWNER_DATABASE_URL;
export const e2eEnabled = Boolean(baseUrl && ownerUrl);

export interface Reply<T = any> {
  status: number;
  data: T;
  error?: { code: string; message: string };
}

export async function call<T = any>(
  method: string,
  path: string,
  options: { token?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<Reply<T>> {
  const response = await fetch(`${baseUrl}/api/v1${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      ...options.headers,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : {};
  return { status: response.status, data: json.data, error: json.error };
}

export function ownerClient(): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: ownerUrl ?? '' }) });
}

export const PASSWORD = 'Str0ng-Passw0rd!x';

/** Registers, verifies (via the owner connection) and signs in; returns the access token. */
export async function signUp(
  owner: PrismaClient,
  email: string,
): Promise<{ token: string; userId: string }> {
  const registered = await call('POST', '/auth/register', {
    body: { email, password: PASSWORD, displayName: email.split('@')[0] },
  });
  if (registered.status !== 202) {
    throw new Error(`register failed: ${registered.status} ${registered.error?.message}`);
  }
  await owner.user.update({
    where: { email },
    data: { status: 'ACTIVE', emailVerifiedAt: new Date() },
  });
  const login = await call('POST', '/auth/login', { body: { email, password: PASSWORD } });
  if (login.status !== 200) {
    throw new Error(`login failed: ${login.status} ${login.error?.message}`);
  }
  return { token: login.data.accessToken, userId: login.data.user.id };
}
