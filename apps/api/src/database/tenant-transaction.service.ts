import { Injectable } from '@nestjs/common';
import { Prisma } from './prisma-client';
import { PrismaService } from './prisma.service';
import { TenantContext, TenantContextService } from './tenant-context.service';

/** Transaction client handed to feature repositories. */
export type TenantPrismaClient = Prisma.TransactionClient;

/**
 * The only place in the codebase that sets PostgreSQL session configuration.
 *
 *   return this.tenantTransaction.withTenant(async (tx, tenant) => {
 *     return tx.event.findMany({ where: { organizationId: tenant.organizationId } });
 *   });
 *
 * `set_config(name, value, true)` is transaction-local, so a pooled connection
 * returns to an empty context at commit/rollback and cannot leak between requests.
 *
 * Three scopes exist, and no other code sets these variables:
 *   - withTenant          an authenticated member acting inside one organisation.
 *   - withUserScope       the caller's own identity, used to resolve a membership
 *                         before tenant context exists (bootstrap).
 *   - withPublicOrganization  a public read for one organisation, resolved from a
 *                         public identifier such as a workspace slug or a published event.
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
   * For background jobs and other non-HTTP entry points: establish the tenant scope
   * explicitly, then run the callback inside it.
   */
  async withTenantContext<T>(
    context: TenantContext,
    callback: (tx: TenantPrismaClient, tenant: TenantContext) => Promise<T>,
  ): Promise<T> {
    return this.tenantContext.run(context, () => this.withTenant(callback));
  }

  /**
   * Bootstrap scope: it identifies the caller, not a tenant.
   *
   * Used only to answer "which organisations does this account belong to", before a
   * tenant can be known. Read-only by convention: writes belong to withTenant.
   */
  async withUserScope<T>(
    userId: string,
    callback: (tx: TenantPrismaClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`;
      return callback(tx);
    });
  }

  /**
   * Public read scope for one organisation, resolved from a public identifier.
   * There is no user: this is what an anonymous visitor is allowed to see.
   */
  async withPublicOrganization<T>(
    organizationId: string,
    callback: (tx: TenantPrismaClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_organization_id', ${organizationId}, true)`;
      return callback(tx);
    });
  }
}
