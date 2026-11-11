import { describe, expect, it } from 'vitest';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { firstValueFrom, of, throwError } from 'rxjs';
import type { TenantContextService } from '../../database/tenant-context.service';
import { IdempotencyInterceptor } from './idempotency.interceptor';
import type {
  BeginIdempotencyResult,
  IdempotencyService,
} from './idempotency.service';

interface Harness {
  interceptor: IdempotencyInterceptor;
  handlerCalls: () => number;
  beginCalls: () => number;
  completed: Array<{ status: number; body: unknown }>;
  abandoned: () => number;
}

function build(
  beginResult: BeginIdempotencyResult,
  options: { handlerError?: unknown; headers?: Record<string, string> } = {},
): {
  harness: Harness;
  context: ExecutionContext;
  response: { statusCode: number };
  next: CallHandler;
} {
  let handlerCalls = 0;
  let beginCalls = 0;
  let abandoned = 0;
  const completed: Array<{ status: number; body: unknown }> = [];

  const request = {
    headers: options.headers ?? { 'idempotency-key': 'key-1' },
    body: { name: 'Village' },
    query: {},
    method: 'POST',
    originalUrl: '/api/v1/workspaces/acme/events',
    route: { path: '/workspaces/:slug/events' },
    ip: '203.0.113.7',
  };

  const response = {
    statusCode: 200,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
  };

  const context = {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ExecutionContext;

  const next = {
    handle: () => {
      handlerCalls += 1;
      return options.handlerError
        ? throwError(() => options.handlerError)
        : of({ ok: true });
    },
  } as CallHandler;

  const reflector = {
    getAllAndOverride: () => true,
  } as unknown as Reflector;

  const idempotency = {
    begin: async () => {
      beginCalls += 1;
      return beginResult;
    },
    complete: async (_input: unknown, status: number, body: unknown) => {
      completed.push({ status, body });
    },
    abandon: async () => {
      abandoned += 1;
    },
  } as unknown as IdempotencyService;

  const tenantContext = {
    get: () => undefined,
  } as unknown as TenantContextService;

  const interceptor = new IdempotencyInterceptor(reflector, idempotency, tenantContext);

  return {
    harness: {
      interceptor,
      handlerCalls: () => handlerCalls,
      beginCalls: () => beginCalls,
      completed,
      abandoned: () => abandoned,
    },
    context,
    response,
    next,
  };
}

describe('IdempotencyInterceptor', () => {
  it('does nothing without the header', async () => {
    const { harness, context, next } = build({ kind: 'proceed' }, { headers: {} });

    const result = await firstValueFrom(
      harness.interceptor.intercept(context, next),
    );

    expect(result).toEqual({ ok: true });
    expect(harness.beginCalls()).toBe(0);
  });

  it('runs the handler and stores the response for a new key', async () => {
    const { harness, context, next } = build({ kind: 'proceed' });

    const result = await firstValueFrom(
      harness.interceptor.intercept(context, next),
    );

    expect(result).toEqual({ ok: true });
    expect(harness.handlerCalls()).toBe(1);
    expect(harness.completed).toEqual([{ status: 201, body: { ok: true } }]);
  });

  it('replays the stored response without running the handler', async () => {
    const { harness, context, response, next } = build({
      kind: 'replay',
      status: 201,
      body: { data: { id: 'event-1' }, meta: {} },
    });

    const result = await firstValueFrom(
      harness.interceptor.intercept(context, next),
    );

    expect(result).toEqual({ data: { id: 'event-1' }, meta: {} });
    expect(harness.handlerCalls()).toBe(0);
    expect(response.statusCode).toBe(201);
  });

  it('refuses the same key with a different payload', async () => {
    const { harness, context, next } = build({ kind: 'conflict' });

    const error = await firstValueFrom(
      harness.interceptor.intercept(context, next),
    ).catch((caught: unknown) => caught);

    expect(error).toMatchObject({ code: 'idempotency_conflict' });
  });

  it('refuses a key that is still in flight', async () => {
    const { harness, context, next } = build({ kind: 'in_progress' });

    const error = await firstValueFrom(
      harness.interceptor.intercept(context, next),
    ).catch((caught: unknown) => caught);

    expect(error).toMatchObject({ code: 'idempotency_in_progress' });
  });

  it('releases the pending row when the handler fails', async () => {
    const { harness, context, next } = build(
      { kind: 'proceed' },
      { handlerError: new Error('boom') },
    );

    const error = await firstValueFrom(
      harness.interceptor.intercept(context, next),
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(Error);
    expect(harness.abandoned()).toBe(1);
  });

  it('rejects an unusable key before doing anything', () => {
    const { harness, context, next } = build(
      { kind: 'proceed' },
      { headers: { 'idempotency-key': 'x'.repeat(201) } },
    );

    expect(() => harness.interceptor.intercept(context, next)).toThrowError(
      expect.objectContaining({ code: 'invalid_idempotency_key' }),
    );
  });
});
