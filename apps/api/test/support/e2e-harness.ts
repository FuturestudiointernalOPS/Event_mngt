import { randomBytes, randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  ORGANIZATION_CAPABILITY_KEYS,
  withCapabilityDependencies,
} from '@event-platform/shared';
import { PrismaClient } from '../../src/database/prisma-client';

/**
 * Harness for the HTTP journey specs (WP-21).
 *
 * They drive a running API and a real database, so `npm test` skips them unless the
 * three documented variables are present:
 *
 *   E2E_BASE_URL            the running API (with or without /api/v1)
 *   TEST_OWNER_DATABASE_URL owner connection, used only to create fixtures
 *   TEST_APP_DATABASE_URL   runtime connection, proving the API runs as a non-owner
 *
 * Fixtures are written through the owner connection on purpose: assertions must go
 * through HTTP, so row-level security stays engaged for everything the journey proves.
 */

const BASE_URL = process.env.E2E_BASE_URL;
const OWNER_URL = process.env.TEST_OWNER_DATABASE_URL;
const APP_URL = process.env.TEST_APP_DATABASE_URL;

export const e2eEnabled = Boolean(BASE_URL && OWNER_URL && APP_URL);

export const API_BASE_URL = normalizeBaseUrl(BASE_URL ?? 'http://127.0.0.1:4000');
export const OWNER_DATABASE_URL = OWNER_URL ?? '';

export function createOwnerClient(): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: OWNER_DATABASE_URL }),
  });
}

export interface E2EFixtures {
  runId: string;
  slug: string;
  organizationId: string;
  roleId: string;
  adminUserId: string;
  adminEmail: string;
  adminPassword: string;
  inviteeUserId: string;
  inviteeEmail: string;
  inviteePassword: string;
  emails: string[];
}

/**
 * One organisation entitled to every workspace capability, with an administrator whose
 * capabilities are granted directly. Direct grants keep the fixture independent of the
 * legacy role-permission mapping, which is still being retired.
 */
export async function createE2EFixtures(owner: PrismaClient): Promise<E2EFixtures> {
  const runId = randomUUID().replace(/-/g, '').slice(0, 12);
  const slug = `e2e-${runId}`;
  const emailDomain = `${runId}.e2e.test`;
  const adminEmail = `admin@${emailDomain}`;
  const inviteeEmail = `invitee@${emailDomain}`;
  const adminPassword = `E2e-${randomBytes(12).toString('hex')}`;
  const inviteePassword = `E2e-${randomBytes(12).toString('hex')}`;

  const organization = await owner.organization.create({
    data: { slug, name: `E2E ${runId}` },
  });

  await owner.workspaceSettings.create({
    data: { organizationId: organization.id, defaultLocale: 'fr', timeZone: 'UTC' },
  });
  await owner.workspaceBranding.create({ data: { organizationId: organization.id } });

  const role = await owner.organizationRole.create({
    data: {
      organizationId: organization.id,
      key: 'e2e-admin',
      name: 'E2E administrator',
      description: 'Fixture role; capabilities come from direct grants.',
    },
  });

  const capabilityKeys = withCapabilityDependencies(ORGANIZATION_CAPABILITY_KEYS);

  await owner.organizationCapability.createMany({
    data: capabilityKeys.map((capabilityKey) => ({
      organizationId: organization.id,
      capabilityKey,
    })),
    skipDuplicates: true,
  });

  const admin = await owner.user.create({
    data: {
      email: adminEmail,
      passwordHash: await argon2.hash(adminPassword, { type: argon2.argon2id }),
      displayName: 'E2E Administrator',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
    },
  });

  const membership = await owner.organizationMember.create({
    data: {
      organizationId: organization.id,
      userId: admin.id,
      roleId: role.id,
      status: 'ACTIVE',
      joinedAt: new Date(),
    },
  });

  await owner.memberCapability.createMany({
    data: capabilityKeys.map((capabilityKey) => ({
      organizationId: organization.id,
      memberId: membership.id,
      capabilityKey,
    })),
    skipDuplicates: true,
  });

  const invitee = await owner.user.create({
    data: {
      email: inviteeEmail,
      passwordHash: await argon2.hash(inviteePassword, { type: argon2.argon2id }),
      displayName: 'E2E Invitee',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
    },
  });

  return {
    runId,
    slug,
    organizationId: organization.id,
    roleId: role.id,
    adminUserId: admin.id,
    adminEmail,
    adminPassword,
    inviteeUserId: invitee.id,
    inviteeEmail,
    inviteePassword,
    emails: [adminEmail, inviteeEmail],
  };
}

export async function destroyE2EFixtures(
  owner: PrismaClient,
  fixtures: E2EFixtures,
): Promise<void> {
  // Consent records hold a RESTRICT reference to their wording row on purpose.
  await owner.consentRecord.deleteMany({
    where: { organizationId: fixtures.organizationId },
  });
  await owner.auditLog.deleteMany({
    where: { organizationId: fixtures.organizationId },
  });
  await owner.organization.deleteMany({ where: { id: fixtures.organizationId } });
  await owner.user.deleteMany({ where: { email: { in: fixtures.emails } } });
}

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export interface ApiError {
  code: string;
  message: string;
}

export interface ApiResult<T> {
  status: number;
  data: T | null;
  error: ApiError | null;
  meta: Record<string, unknown> | null;
}

export interface ApiOptions {
  token?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

export async function api<T = unknown>(
  method: HttpMethod,
  path: string,
  options: ApiOptions = {},
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = {
    accept: 'application/json',
    ...options.headers,
  };

  if (options.token) {
    headers.authorization = `Bearer ${options.token}`;
  }
  const isMultipart =
    typeof FormData !== 'undefined' && options.body instanceof FormData;

  if (options.body !== undefined && !isMultipart) {
    headers['content-type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    ...(options.body === undefined
      ? {}
      : { body: isMultipart ? (options.body as FormData) : JSON.stringify(options.body) }),
  });

  const text = await response.text();
  let parsed: unknown = null;

  if (text.length > 0) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }

  const envelope =
    typeof parsed === 'object' && parsed !== null
      ? (parsed as {
          data?: unknown;
          error?: ApiError;
          meta?: Record<string, unknown>;
        })
      : null;

  return {
    status: response.status,
    data: (envelope?.data ?? null) as T | null,
    error: envelope?.error ?? null,
    meta: envelope?.meta ?? null,
  };
}

export async function login(email: string, password: string): Promise<string> {
  const result = await api<{ accessToken: string }>('POST', '/auth/login', {
    body: { email, password },
  });

  if (result.status !== 200 || !result.data?.accessToken) {
    throw new Error(
      `login failed for ${email} (${result.status}): ${JSON.stringify(result.error)}`,
    );
  }

  return result.data.accessToken;
}

/** Fails a setup step with the server's own error instead of a downstream null. */
export function expectData<T>(result: ApiResult<T>, label: string): T {
  if (result.data === null) {
    throw new Error(
      `${label} failed (${result.status}): ${JSON.stringify(result.error)}`,
    );
  }

  return result.data;
}

function normalizeBaseUrl(value: string): string {
  const trimmed = value.replace(/\/+$/, '');
  return trimmed.endsWith('/api/v1') ? trimmed : `${trimmed}/api/v1`;
}
