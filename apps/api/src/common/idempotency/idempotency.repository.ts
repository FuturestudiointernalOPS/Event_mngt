import { Injectable } from '@nestjs/common';
import { Prisma } from '../../database/prisma-client';
import { PrismaService } from '../../database/prisma.service';
import type { TenantPrismaClient } from '../../database/tenant-transaction.service';

/** Both the tenant transaction client and PrismaService expose this delegate. */
export interface IdempotencyStore {
  idempotencyRecord: TenantPrismaClient['idempotencyRecord'];
}

export interface IdempotencyRow {
  id: string;
  requestHash: string;
  responseStatus: number;
  responseBody: unknown;
  expiresAt: Date;
}

export interface CreateIdempotencyData {
  scope: string;
  key: string;
  requestHash: string;
  organizationId: string | null;
  expiresAt: Date;
}

/**
 * Storage for replay records. It holds no business rule: the service decides whether a
 * row means replay, conflict or proceed.
 */
@Injectable()
export class IdempotencyRepository {
  constructor(private readonly prisma: PrismaService) {}

  find(store: IdempotencyStore, scope: string, key: string): Promise<IdempotencyRow | null> {
    return store.idempotencyRecord.findUnique({
      where: { scope_key: { scope, key } },
      select: {
        id: true,
        requestHash: true,
        responseStatus: true,
        responseBody: true,
        expiresAt: true,
      },
    });
  }

  async create(store: IdempotencyStore, data: CreateIdempotencyData): Promise<void> {
    await store.idempotencyRecord.create({
      data: { ...data, responseBody: Prisma.DbNull },
    });
  }

  async complete(
    store: IdempotencyStore,
    scope: string,
    key: string,
    status: number,
    body: unknown,
  ): Promise<void> {
    await store.idempotencyRecord.update({
      where: { scope_key: { scope, key } },
      data: {
        responseStatus: status,
        responseBody:
          body === undefined ? Prisma.DbNull : (body as Prisma.InputJsonValue),
      },
    });
  }

  async deleteById(store: IdempotencyStore, id: string): Promise<void> {
    await store.idempotencyRecord.delete({ where: { id } });
  }

  /** Removes a row left pending by a failed handler, never a completed response. */
  async deletePending(store: IdempotencyStore, scope: string, key: string): Promise<void> {
    await store.idempotencyRecord.deleteMany({
      where: { scope, key, responseStatus: 0 },
    });
  }
}
