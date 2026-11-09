/**
 * Load and correctness test against a RUNNING API (rate limiting must be off).
 *
 *   LOAD_BASE_URL=http://localhost:4010 LOAD_OWNER_DATABASE_URL=postgresql://... \
 *     npx ts-node scripts/load-test.ts [--registrants 400] [--capacity 300] [--concurrency 50]
 *
 * Scenarios: (1) registration burst into a capacity-limited category, (2) badge download and
 * check-in peak, (3) public page reads. It fails (exit 1) if capacity is ever exceeded or
 * attendance is ever double counted: those are correctness properties, not just speed.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { createHash } from 'node:crypto';
import { PrismaClient } from '../src/database/prisma-client';

const arg = (name: string, fallback: number): number => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? Number(process.argv[i + 1]) : fallback;
};
const BASE = process.env.LOAD_BASE_URL ?? 'http://localhost:4000';
const OWNER = process.env.LOAD_OWNER_DATABASE_URL;
const REGISTRANTS = arg('registrants', 400);
const CAPACITY = arg('capacity', 300);
const CONCURRENCY = arg('concurrency', 50);
const PASSWORD = 'Str0ng-Passw0rd!x';

if (!OWNER) {
  throw new Error('Set LOAD_OWNER_DATABASE_URL (migration-owner connection, used to verify the test account).');
}

const owner = new PrismaClient({ adapter: new PrismaPg({ connectionString: OWNER }) });

interface Timed<T> { value: T; ms: number }

async function timed<T>(fn: () => Promise<T>): Promise<Timed<T>> {
  const start = performance.now();
  const value = await fn();
  return { value, ms: performance.now() - start };
}

/** Runs `items` through `fn` with at most `limit` in flight. */
async function pool<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<Timed<R>[]> {
  const results: Timed<R>[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next;
        next += 1;
        results[index] = await timed(() => fn(items[index], index));
      }
    }),
  );
  return results;
}

const pct = (values: number[], p: number): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] ?? 0;
};

function report(label: string, results: Timed<unknown>[], wallMs: number): void {
  const ms = results.map((r) => r.ms);
  console.log(
    `${label.padEnd(28)} n=${String(results.length).padStart(4)}  ${(results.length / (wallMs / 1000)).toFixed(0).padStart(5)} req/s  ` +
      `p50=${pct(ms, 50).toFixed(0).padStart(4)}ms  p95=${pct(ms, 95).toFixed(0).padStart(4)}ms  p99=${pct(ms, 99).toFixed(0).padStart(4)}ms`,
  );
}

async function api(method: string, path: string, options: { token?: string; body?: unknown; headers?: Record<string, string> } = {}) {
  const response = await fetch(`${BASE}/api/v1${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(options.token && { authorization: `Bearer ${options.token}` }), ...options.headers },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : {};
  return { status: response.status, data: json.data, error: json.error as { code: string } | undefined };
}

async function main(): Promise<void> {
  const tag = `load${Date.now()}`;
  const email = `${tag}@example.test`;
  const slug = `${tag}-org`;
  console.log(`Load test: ${REGISTRANTS} registrants, capacity ${CAPACITY}, concurrency ${CONCURRENCY}, ${BASE}\n`);

  await api('POST', '/auth/register', { body: { email, password: PASSWORD } });
  await owner.user.update({ where: { email }, data: { status: 'ACTIVE', emailVerifiedAt: new Date() } });
  const token = (await api('POST', '/auth/login', { body: { email, password: PASSWORD } })).data.accessToken as string;
  const orgId = (await api('POST', '/organizations', { token, body: { name: 'Load Org', slug } })).data.id as string;
  const event = (await api('POST', `/workspaces/${slug}/events`, {
    token,
    body: { name: 'Load Summit', timeZone: 'UTC', startsAt: '2027-06-01T09:00:00Z', endsAt: '2027-06-01T17:00:00Z', visibility: 'PUBLIC' },
  })).data;
  const base = `/workspaces/${slug}/events/${event.id}`;
  await api('PUT', `${base}/modules/registration`, { token, body: { enabled: true, settings: { approvalMode: 'automatic' } } });
  await api('PUT', `${base}/modules/checkin`, { token, body: { enabled: true } });
  await api('POST', `${base}/categories`, { token, body: { key: 'visitor', name: 'Visitor', capacity: CAPACITY } });
  await api('PUT', `${base}/consent`, { token, body: { text: 'We keep your data to run the event.', version: '1' } });
  await api('POST', `${base}/publish`, { token });

  let failed = false;
  const check = (ok: boolean, message: string): void => {
    console.log(`${ok ? '  ok  ' : ' FAIL '} ${message}`);
    if (!ok) failed = true;
  };

  /* 1. Registration burst */
  const people = Array.from({ length: REGISTRANTS }, (_, i) => i);
  let started = performance.now();
  const regs = await pool(people, CONCURRENCY, (i) =>
    api('POST', `/public/events/${event.slug}/registrations`, {
      body: { email: `${tag}-${i}@example.test`, firstName: 'Load', lastName: `T${i}`, categoryKey: 'visitor', answers: {}, consent: true },
    }),
  );
  report('registration burst', regs, performance.now() - started);
  const accepted = regs.filter((r) => r.value.status === 201);
  const full = regs.filter((r) => r.value.error?.code === 'category_full');
  const expected = Math.min(CAPACITY, REGISTRANTS);
  check(accepted.length === expected, `accepted ${accepted.length} = capacity ${expected} (never oversold)`);
  check(full.length === REGISTRANTS - expected, `${full.length} refused with category_full`);
  check((await owner.registration.count({ where: { eventId: event.id } })) === expected, 'database holds exactly the accepted registrations');

  /* 2. Badge download + check-in peak */
  const rows = await owner.registration.findMany({ where: { eventId: event.id }, select: { id: true } });
  await Promise.all(rows.map((r) => owner.registration.update({
    where: { id: r.id },
    data: { accessTokenHash: createHash('sha256').update(`secret-${r.id}`).digest('hex') },
  })));
  started = performance.now();
  const badges = await pool(rows, CONCURRENCY, async (r) =>
    (await api('GET', '/participant/me', { headers: { 'x-participant-token': `${orgId}.${r.id}.secret-${r.id}` } })).data.badgeCode as string,
  );
  report('badge download', badges, performance.now() - started);

  const codes = badges.map((b) => b.value);
  started = performance.now();
  // Every badge is scanned twice, concurrently, as two entrance devices would.
  const scans = await pool([...codes, ...codes], CONCURRENCY, (code) => api('POST', `${base}/check-in/scans`, { token, body: { code } }));
  report('check-in (each badge x2)', scans, performance.now() - started);
  const kinds = scans.map((s) => s.value.data?.result as string);
  check(kinds.filter((k) => k === 'checked_in').length === codes.length, `${codes.length} first scans recorded`);
  check(kinds.filter((k) => k === 'duplicate').length === codes.length, `${codes.length} second scans reported as duplicates`);
  check((await owner.checkIn.count({ where: { eventId: event.id } })) === codes.length, 'exactly one attendance per participant in the database');

  /* 3. Public reads */
  started = performance.now();
  const reads = await pool(Array.from({ length: 500 }), CONCURRENCY, () => api('GET', `/public/events/${event.slug}`));
  report('public event page reads', reads, performance.now() - started);
  check(reads.every((r) => r.value.status === 200), 'all public reads succeeded');

  await owner.organization.deleteMany({ where: { slug: { startsWith: tag } } });
  await owner.person.deleteMany({ where: { email: { startsWith: tag } } });
  await owner.user.deleteMany({ where: { email } });
  await owner.$disconnect();

  console.log(failed ? '\nLOAD TEST FAILED' : '\nLoad test passed');
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
