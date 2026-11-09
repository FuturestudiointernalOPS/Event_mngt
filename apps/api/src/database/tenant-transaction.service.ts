import { Injectable } from '@nestjs/common';
import { Prisma } from './prisma-client';
import { PrismaService } from './prisma.service';
import { TenantContext, TenantContextService } from './tenant-context.service';

/** Transaction client handed to feature repositories. */
export type TenantPrismaClient = Prisma.TransactionClient;

/**
 * The only place in the codebase that sets PostgreSQL tenant context.
 *
 *   return this.tenantTransaction.withTenant(async (tx, tenant) => {
 *     return tx.event.findMany({ where: { organizationId: tenant.organizationId } });
 *   });
 *
 * `set_config(name, value, true)` is transaction-local, so a pooled connection
 * returns to an empty context at commit/rollback and cannot leak between requests.
 */
@Injectable()
export class TenantTransactionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async withTenant<T>(
    callback: (tx: TenantPrismaClient, context: TenantContext) => Promise<T>,
  ): Promise<T> {
    const context = this.tenantContext.getOrThrow();

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_organization_id', ${context.organizationId}, true)`;
      await tx.$executeRaw`SELECT set_config('app.current_user_id', ${context.userId}, true)`;

      return callback(tx, context);
    });
  }

  /**
   * Runs `callback` scoped to the given user only. Used for the few reads that must
   * happen before any organisation is known (e.g. "my memberships"); the matching
   * row-level policies are keyed on `app.current_user_id`.
   */
  async withUser<T>(
    userId: string,
    callback: (tx: TenantPrismaClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`;
      return callback(tx);
    });
  }

  /**
   * Establishes an organisation scope outside a request that already carries one:
   * membership resolution (the organisation is known from a public slug lookup) and
   * organisation creation (the id is generated before the row exists).
   */
  async withOrganization<T>(
    organizationId: string,
    userId: string | null,
    callback: (tx: TenantPrismaClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_organization_id', ${organizationId}, true)`;
      await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userId ?? ''}, true)`;
      return callback(tx);
    });
  }

  /**
   * Platform administration: cross-tenant reads and organisation status changes.
   * Callers MUST have verified the platform-administrator flag from the database first
   * (the token claim alone can be stale). `organizationId` optionally scopes writes such
   * as the audit entry to one organisation.
   */
  async withPlatform<T>(
    organizationId: string | null,
    callback: (tx: TenantPrismaClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.platform_admin', 'true', true)`;
      await tx.$executeRaw`SELECT set_config('app.current_organization_id', ${organizationId ?? ''}, true)`;
      return callback(tx);
    });
  }

  /**
   * For background jobs and other non-HTTP entry points: establish the tenant scope
   * explicitly, then run the callback inside it.
   */
  async withTenantContext<T>(
    context: TenantContext,
    callback: (tx: TenantPrismaClient, tenant: TenantContext) => Promise<T>,
  ): Promise<T> {
    return this.tenantContext.run(context, () => this.withTenant(callback));
  }
}
