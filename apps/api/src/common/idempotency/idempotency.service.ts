import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../../database/prisma-client';
import { PrismaService } from '../../database/prisma.service';
import { TenantTransactionService } from '../../database/tenant-transaction.service';
import type { Env } from '../../config/env.validation';
import { IdempotencyRepository, type IdempotencyStore } from './idempotency.repository';

export interface BeginIdempotencyInput {
  scope: string;
  key: string;
  requestHash: string;
  organizationId: string | null;
}

export type BeginIdempotencyResult =
  | { kind: 'proceed' }
  | { kind: 'replay'; status: number; body: unknown }
  | { kind: 'conflict' }
  | { kind: 'in_progress' };

/**
 * Replay protection (WP-08).
 *
 * A pending row is inserted before the handler runs. That is what makes two concurrent
 * requests with the same key safe: the second one sees the pending row instead of
 * running the handler and creating a second record.
 */
@Injectable()
export class IdempotencyService {
  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly tenantTransaction: TenantTransactionService,
    private readonly prisma: PrismaService,
    private readonly repository: IdempotencyRepository,
  ) {}

  begin(input: BeginIdempotencyInput): Promise<BeginIdempotencyResult> {
    const now = new Date();

    return this.withStore(input.organizationId, (store) =>
      this.beginIn(store, input, now),
    );
  }

  complete(input: BeginIdempotencyInput, status: number, body: unknown): Promise<void> {
    return this.withStore(input.organizationId, (store) =>
      this.repository.complete(store, input.scope, input.key, status, body),
    );
  }

  abandon(input: BeginIdempotencyInput): Promise<void> {
    return this.withStore(input.organizationId, (store) =>
      this.repository.deletePending(store, input.scope, input.key),
    );
  }

  private async beginIn(
    store: IdempotencyStore,
    input: BeginIdempotencyInput,
    now: Date,
  ): Promise<BeginIdempotencyResult> {
    const existing = await this.repository.find(store, input.scope, input.key);

    if (existing) {
      if (existing.expiresAt <= now) {
        await this.repository.deleteById(store, existing.id);
      } else if (existing.requestHash !== input.requestHash) {
        return { kind: 'conflict' };
      } else if (existing.responseStatus !== 0) {
        return {
          kind: 'replay',
          status: existing.responseStatus,
          body: existing.responseBody,
        };
      } else {
        return { kind: 'in_progress' };
      }
    }

    try {
      await this.repository.create(store, {
        ...input,
        expiresAt: new Date(now.getTime() + this.ttlHours() * 3_600_000),
      });
    } catch (error) {
      // Two requests raced: one inserted, the other lost the unique constraint.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return { kind: 'in_progress' };
      }
      throw error;
    }

    return { kind: 'proceed' };
  }

  /**
   * A tenant-owned record must be written where row-level security can see the tenant.
   * Anonymous records have no organisation and are keyed by route and caller instead.
   */
  private withStore<T>(
    organizationId: string | null,
    callback: (store: IdempotencyStore) => Promise<T>,
  ): Promise<T> {
    if (organizationId) {
      return this.tenantTransaction.withTenant((tx) => callback(tx));
    }

    return callback(this.prisma);
  }

  private ttlHours(): number {
    return this.config.get('IDEMPOTENCY_TTL_HOURS', { infer: true });
  }
}
