import { describe, expect, it } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import { Prisma } from '../../database/prisma-client';
import type { PrismaService } from '../../database/prisma.service';
import type { TenantTransactionService } from '../../database/tenant-transaction.service';
import type { Env } from '../../config/env.validation';
import type { IdempotencyRepository, IdempotencyRow } from './idempotency.repository';
import { IdempotencyService, type BeginIdempotencyInput } from './idempotency.service';

const input = (overrides: Partial<BeginIdempotencyInput> = {}): BeginIdempotencyInput => ({
  scope: 'org:org-1',
  key: 'key-1',
  requestHash: 'hash-1',
  organizationId: 'org-1',
  ...overrides,
});

function row(overrides: Partial<IdempotencyRow> = {}): IdempotencyRow {
  return {
    id: 'record-1',
    requestHash: 'hash-1',
    responseStatus: 0,
    responseBody: null,
    expiresAt: new Date(Date.now() + 3_600_000),
    ...overrides,
  };
}

interface Harness {
  service: IdempotencyService;
  created: Array<{ expiresAt: Date }>;
  completed: Array<{ status: number; body: unknown }>;
  deletedById: boolean;
  deletedPending: boolean;
}

function build(options: { existing?: IdempotencyRow | null; createError?: unknown } = {}): Harness {
  let current = options.existing ?? null;
  const created: Array<{ expiresAt: Date }> = [];
  const completed: Array<{ status: number; body: unknown }> = [];
  const harness: Harness = {
    service: undefined as unknown as IdempotencyService,
    created,
    completed,
    deletedById: false,
    deletedPending: false,
  };

  const repository = {
    find: async () => current,
    create: async (_store: unknown, data: { expiresAt: Date }) => {
      if (options.createError) {
        throw options.createError;
      }
      created.push({ expiresAt: data.expiresAt });
      current = row({ requestHash: input().requestHash, expiresAt: data.expiresAt });
    },
    complete: async (_store: unknown, _scope: string, _key: string, status: number, body: unknown) => {
      completed.push({ status, body });
      if (current) {
        current = { ...current, responseStatus: status, responseBody: body };
      }
    },
    deleteById: async () => {
      harness.deletedById = true;
      current = null;
    },
    deletePending: async () => {
      harness.deletedPending = true;
      if (current?.responseStatus === 0) {
        current = null;
      }
    },
  } as unknown as IdempotencyRepository;

  const config = { get: () => 24 } as unknown as ConfigService<Env, true>;
  const tenantTransaction = {
    withTenant: async (callback: (store: unknown) => Promise<unknown>) => callback({}),
  } as unknown as TenantTransactionService;

  harness.service = new IdempotencyService(
    config,
    tenantTransaction,
    {} as PrismaService,
    repository,
  );

  return harness;
}

describe('IdempotencyService.begin', () => {
  it('proceeds and records a pending row with a 24 hour expiry', async () => {
    const harness = build();

    await expect(harness.service.begin(input())).resolves.toEqual({ kind: 'proceed' });
    expect(harness.created).toHaveLength(1);
    expect(harness.created[0].expiresAt.getTime()).toBeGreaterThan(Date.now() + 23 * 3_600_000);
  });

  it('replays a stored response for the same payload', async () => {
    const harness = build({
      existing: row({ responseStatus: 200, responseBody: { id: 'event-1' } }),
    });

    await expect(harness.service.begin(input())).resolves.toEqual({
      kind: 'replay',
      status: 200,
      body: { id: 'event-1' },
    });
  });

  it('refuses the same key with a different payload', async () => {
    const harness = build({ existing: row({ requestHash: 'different' }) });

    await expect(harness.service.begin(input())).resolves.toEqual({ kind: 'conflict' });
  });

  it('reports a pending row instead of running the handler twice', async () => {
    const harness = build({ existing: row() });

    await expect(harness.service.begin(input())).resolves.toEqual({ kind: 'in_progress' });
  });

  it('treats an expired row as a new request', async () => {
    const harness = build({
      existing: row({ expiresAt: new Date(Date.now() - 1_000), responseStatus: 200 }),
    });

    await expect(harness.service.begin(input())).resolves.toEqual({ kind: 'proceed' });
    expect(harness.deletedById).toBe(true);
    expect(harness.created).toHaveLength(1);
  });

  it('reports a unique-constraint race as in progress', async () => {
    const harness = build({
      createError: new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '7.10.1',
      }),
    });

    await expect(harness.service.begin(input())).resolves.toEqual({ kind: 'in_progress' });
  });
});

describe('IdempotencyService.complete and abandon', () => {
  it('stores the status and body of a successful handler', async () => {
    const harness = build();
    await harness.service.begin(input());

    await harness.service.complete(input(), 201, { id: 'event-1' });

    expect(harness.completed).toEqual([{ status: 201, body: { id: 'event-1' } }]);
  });

  it('removes the pending row when the handler fails', async () => {
    const harness = build();
    await harness.service.begin(input());

    await harness.service.abandon(input());

    expect(harness.deletedPending).toBe(true);
  });
});
