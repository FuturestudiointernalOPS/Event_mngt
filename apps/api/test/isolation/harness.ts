import 'dotenv/config';
import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import * as argon2 from 'argon2';
import { ALL_PERMISSIONS, ORGANIZATION_CAPABILITY_KEYS } from '@event-platform/shared';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '../../src/database/prisma-client';

/**
 * Harness for the isolation suite (WP-02).
 *
 * Fixtures are created through the owner connection, because row-level security is
 * exactly what they must not bypass during assertions. Assertions run through a second
 * client connected as the runtime role.
 */

const OWNER_URL = process.env.DATABASE_URL;
const APP_URL = process.env.APP_DATABASE_URL;

export const isolationEnabled = Boolean(OWNER_URL && APP_URL);

export interface Fixtures {
  runId: string;
  slugA: string;
  slugB: string;
  orgA: string;
  orgB: string;
  userA: string;
  emailA: string;
  password: string;
  eventA: string;
  eventB: string;
}

export function createOwnerClient(): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: OWNER_URL as string }),
  });
}

export function createAppClient(): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: APP_URL as string }),
  });
}

export async function createFixtures(owner: PrismaClient): Promise<Fixtures> {
  const runId = randomUUID().slice(0, 8);

  for (const key of ALL_PERMISSIONS) {
    await owner.permission.upsert({ where: { key }, create: { key }, update: {} });
  }

  const permissions = await owner.permission.findMany({ select: { id: true } });

  async function organization(suffix: string, name: string) {
    const slug = `isolation-${suffix}-${runId}`;
    const row = await owner.organization.create({ data: { slug, name } });

    await owner.workspaceSettings.create({
      data: { organizationId: row.id, defaultLocale: 'fr', timeZone: 'UTC' },
    });
    await owner.workspaceBranding.create({ data: { organizationId: row.id } });

    const role = await owner.organizationRole.create({
      data: {
        organizationId: row.id,
        key: 'isolation-admin',
        name: 'Isolation admin',
        permissions: {
          create: permissions.map((permission) => ({
            permission: { connect: { id: permission.id } },
          })),
        },
      },
    });

    await owner.organizationCapability.createMany({
      data: ORGANIZATION_CAPABILITY_KEYS.map((capabilityKey) => ({
        organizationId: row.id,
        capabilityKey,
      })),
      skipDuplicates: true,
    });

    return { id: row.id, slug, roleId: role.id };
  }

  async function account(suffix: string) {
    const email = `isolation-${suffix}-${runId}@example.test`;
    const password = `isolation-${randomBytes(8).toString('hex')}`;
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

    const user = await owner.user.create({
      data: {
        email,
        passwordHash,
        displayName: `Isolation ${suffix.toUpperCase()}`,
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
      },
    });

    return { id: user.id, email, password };
  }

  const orgA = await organization('a', 'Isolation A');
  const orgB = await organization('b', 'Isolation B');
  const accountA = await account('a');
  const accountB = await account('b');

  const membershipA = await owner.organizationMember.create({
    data: {
      organizationId: orgA.id,
      userId: accountA.id,
      roleId: orgA.roleId,
      status: 'ACTIVE',
      joinedAt: new Date(),
    },
  });

  await owner.organizationMember.create({
    data: {
      organizationId: orgB.id,
      userId: accountB.id,
      roleId: orgB.roleId,
      status: 'ACTIVE',
      joinedAt: new Date(),
    },
  });

  await owner.memberCapability.create({
    data: {
      organizationId: orgA.id,
      memberId: membershipA.id,
      capabilityKey: 'organization.view_audit_log',
    },
  });

  async function event(organizationId: string, createdByUserId: string, suffix: string) {
    const row = await owner.event.create({
      data: {
        organizationId,
        createdByUserId,
        slug: `isolation-event-${suffix}-${runId}`,
        name: `Isolation event ${suffix.toUpperCase()}`,
        format: 'IN_PERSON',
        visibility: 'PRIVATE',
        status: 'DRAFT',
        timeZone: 'UTC',
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 3_600_000),
      },
    });

    await owner.eventModule.create({
      data: { eventId: row.id, moduleKey: 'core', enabled: true },
    });

    return row.id;
  }

  const eventA = await event(orgA.id, accountA.id, 'a');
  const eventB = await event(orgB.id, accountB.id, 'b');

  for (const [index, organizationId] of [orgA.id, orgB.id].entries()) {
    await owner.auditLog.create({
      data: { organizationId, action: 'isolation.fixture', targetType: 'test' },
    });
    await owner.invitation.create({
      data: {
        organizationId,
        email: `pending-${index}-${runId}@example.test`,
        roleId: index === 0 ? orgA.roleId : orgB.roleId,
        tokenHash: randomUUID(),
        invitedByUserId: index === 0 ? accountA.id : accountB.id,
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    await owner.idempotencyRecord.create({
      data: {
        scope: `org:${organizationId}`,
        key: `isolation-fixture-${index}`,
        requestHash: randomUUID(),
        responseStatus: 201,
        responseBody: { fixture: true },
        organizationId,
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });

    // Wave 2: one row in every registration-owned table, so the isolation
    // assertions have something to fail on if a policy is missing.
    const eventId = index === 0 ? eventA : eventB;
    const category = await owner.participantCategory.create({
      data: { organizationId, eventId, key: 'isolation-category', name: 'Isolation category' },
    });
    const form = await owner.registrationForm.create({
      data: { organizationId, eventId, title: 'Isolation form', version: 1 },
    });
    const field = await owner.registrationField.create({
      data: {
        organizationId,
        formId: form.id,
        key: 'motivation',
        label: 'Motivation',
        type: 'TEXT',
        required: false,
      },
    });
    const person = await owner.person.create({
      data: {
        organizationId,
        email: `isolation-person-${index}-${runId}@example.test`,
        firstName: 'Isolation',
        lastName: `Person ${index}`,
      },
    });
    const registration = await owner.registration.create({
      data: {
        organizationId,
        eventId,
        personId: person.id,
        categoryId: category.id,
        reference: `EP-ISO${index}${runId.slice(0, 4).toUpperCase()}`,
        status: 'PENDING',
        source: 'PUBLIC',
      },
    });
    await owner.registrationAnswer.create({
      data: {
        organizationId,
        registrationId: registration.id,
        fieldId: field.id,
        fieldKey: 'motivation',
        value: 'fixture',
      },
    });
    const document = await owner.consentDocument.create({
      data: {
        organizationId,
        eventId,
        key: 'privacy',
        version: 1,
        title: 'Privacy',
        body: 'Fixture wording',
        required: true,
        publishedAt: new Date(),
      },
    });
    await owner.consentRecord.create({
      data: {
        organizationId,
        registrationId: registration.id,
        documentId: document.id,
        documentKey: 'privacy',
        documentVersion: 1,
        accepted: true,
      },
    });
    await owner.badge.create({
      data: { organizationId, eventId, registrationId: registration.id, tokenHash: randomUUID() },
    });
    const profile = await owner.participantProfile.create({
      data: { organizationId, eventId, registrationId: registration.id },
    });
    await owner.organizationProfile.create({
      data: {
        organizationId,
        name: `Isolation organisation ${index}`,
        moderationStatus: 'APPROVED',
        visibility: 'PRIVATE',
      },
    });
    await owner.innovation.create({
      data: {
        organizationId,
        eventId,
        participantProfileId: profile.id,
        title: 'Isolation listing',
      },
    });

    // Wave 3: attendance, one meeting, and one introduction with its first history row.
    const operatorUserId = index === 0 ? accountA.id : accountB.id;
    await owner.checkIn.create({
      data: {
        organizationId,
        eventId,
        registrationId: registration.id,
        source: 'ONLINE',
        scannedAt: new Date(),
        receivedAt: new Date(),
        checkedInByUserId: operatorUserId,
      },
    });
    await owner.meeting.create({
      data: {
        organizationId,
        eventId,
        proposerProfileId: profile.id,
        recipientProfileId: profile.id,
      },
    });
    const introduction = await owner.introductionRequest.create({
      data: { organizationId, eventId, requestingProfileId: profile.id },
    });
    await owner.introductionStatusHistory.create({
      data: {
        organizationId,
        eventId,
        requestId: introduction.id,
        toStatus: 'REQUESTED',
        actorUserId: operatorUserId,
      },
    });

    // Wave 4: an export is tenant data because it snapshots participant rows.
    await owner.reportExport.create({
      data: {
        organizationId,
        eventId,
        requestedByUserId: index === 0 ? accountA.id : accountB.id,
        format: 'CSV',
        status: 'COMPLETED',
        fileName: `isolation-${index}-${runId}.csv`,
        contentType: 'text/csv; charset=utf-8',
        content: Buffer.from('reference\r\n'),
        rowCount: 1,
        byteSize: 11,
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
  }

  return {
    runId,
    slugA: orgA.slug,
    slugB: orgB.slug,
    orgA: orgA.id,
    orgB: orgB.id,
    userA: accountA.id,
    emailA: accountA.email,
    password: accountA.password,
    eventA,
    eventB,
  };
}

export async function destroyFixtures(owner: PrismaClient, fixtures: Fixtures): Promise<void> {
  const organizations = [fixtures.orgA, fixtures.orgB];

  // Consent records hold a RESTRICT reference to their document on purpose, so the
  // evidence cannot disappear with a wording row. Delete them before the organisation.
  await owner.consentRecord.deleteMany({
    where: { organizationId: { in: organizations } },
  });
  await owner.auditLog.deleteMany({ where: { organizationId: { in: organizations } } });
  // Cascades to members, roles, role permissions, events, modules, settings, branding,
  // categories, forms, registrations, answers, badges, profiles, listings, check-ins,
  // meetings, introductions and their history rows.
  await owner.organization.deleteMany({ where: { id: { in: organizations } } });
  await owner.user.deleteMany({
    where: { email: { endsWith: `${fixtures.runId}@example.test` } },
  });
}

/** Runs a callback inside a transaction scoped to a user, a tenant, or both. */
export async function withScope<T>(
  client: PrismaClient,
  scope: { user?: string; org?: string },
  callback: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return client.$transaction(
    async (tx) => {
      if (scope.org) {
        await tx.$queryRawUnsafe(
          "SELECT set_config('app.current_organization_id', $1, true)",
          scope.org,
        );
      }
      if (scope.user) {
        await tx.$queryRawUnsafe("SELECT set_config('app.current_user_id', $1, true)", scope.user);
      }

      return callback(tx);
    },
    // The pooler is shared and its connection budget is modest; give concurrent scopes
    // room to queue instead of failing fast.
    { maxWait: 15_000, timeout: 30_000 },
  );
}

export interface RunningApi {
  baseUrl: string;
  stop: () => Promise<void>;
}

export async function startApi(): Promise<RunningApi> {
  if (!existsSync(resolve(process.cwd(), 'dist/main.js'))) {
    execFileSync('npm', ['run', 'build'], { cwd: process.cwd(), stdio: 'ignore' });
  }

  const port = await freePort();
  const child = spawn(process.execPath, ['dist/main.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port), NODE_ENV: 'test' },
    stdio: 'ignore',
  });

  const baseUrl = `http://127.0.0.1:${port}/api/v1`;
  await waitForReady(baseUrl);

  return { baseUrl, stop: () => stopChild(child) };
}

export async function login(baseUrl: string, email: string, password: string): Promise<string> {
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const body = (await response.json()) as { data?: { accessToken?: string } };

  if (!response.ok || !body.data?.accessToken) {
    throw new Error(`login failed (${response.status}): ${JSON.stringify(body)}`);
  }

  return body.data.accessToken;
}

export async function apiGet(
  baseUrl: string,
  token: string,
  path: string,
): Promise<{ status: number; body: { data?: unknown } }> {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { authorization: `Bearer ${token}` },
  });

  return { status: response.status, body: (await response.json()) as { data?: unknown } };
}

function freePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address !== null ? address.port : 0;
      server.close(() => resolvePort(port));
    });
  });
}

async function waitForReady(baseUrl: string): Promise<void> {
  const deadline = Date.now() + 40_000;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/health/ready`);
      if (response.ok) {
        return;
      }
    } catch {
      // not listening yet
    }
    await new Promise((sleep) => setTimeout(sleep, 300));
  }

  throw new Error('The API did not become ready within 40s. Check dist/main.js and .env.');
}

function stopChild(child: ChildProcess): Promise<void> {
  return new Promise((resolveStop) => {
    if (child.exitCode !== null) {
      resolveStop();
      return;
    }

    const kill = setTimeout(() => child.kill('SIGKILL'), 5_000);
    child.once('exit', () => {
      clearTimeout(kill);
      resolveStop();
    });
    child.kill('SIGTERM');
  });
}
