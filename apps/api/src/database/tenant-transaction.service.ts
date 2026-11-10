import { Injectable } from '@nestjs/common';
import { Prisma } from './prisma-client';
import { PrismaService } from './prisma.service';
import { TenantContext, TenantContextService } from './tenant-context.service';

/** Transaction client handed to feature repositories. */
export type TenantPrismaClient = Prisma.TransactionClient;

/**
 * Provisioning makes many sequential writes over a pooled connection, and platform
 * support counts can scan several tenant tables. Give those scopes room to finish
 * instead of failing at the default interactive-transaction deadline.
 */
const TRANSACTION_OPTIONS = { maxWait: 15_000, timeout: 30_000 } as const;

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
 * Four scopes exist, and no other code sets these variables:
 *   - withTenant          an authenticated member acting inside one organisation.
 *   - withUserScope       the caller's own identity, used to resolve a membership
 *                         before tenant context exists (bootstrap).
 *   - withOrganizationScope  a public read for one organisation, resolved from a
 *                         public identifier such as a workspace slug or a published event.
 *   - withPlatformAdmin   a verified platform administrator reading organisation
 *                         identity and managing organisation entitlements across tenants.
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
   * Organisation scope for a case that has no tenant context: a public read resolved
   * from a workspace slug or a published event, or accepting an invitation whose
   * organisation came from the invitation itself. The organisation always comes from
   * a server-side identifier, never from the client.
   */
  async withOrganizationScope<T>(
    organizationId: string,
    callback: (tx: TenantPrismaClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_organization_id', ${organizationId}, true)`;
      return callback(tx);
    });
  }

  /**
   * Onboarding scope: the first write for a brand-new organisation.
   *
   * The organisation id is generated server-side and the actor is authenticated. This
   * is the only path that may create organisation-owned rows before any membership
   * exists; it is not reachable from a public route.
   */
  async withOrganizationProvisioning<T>(
    organizationId: string,
    actorUserId: string,
    callback: (tx: TenantPrismaClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.current_organization_id', ${organizationId}, true)`;
        await tx.$executeRaw`SELECT set_config('app.current_user_id', ${actorUserId}, true)`;
        return callback(tx);
      },
      TRANSACTION_OPTIONS,
    );
  }

  /**
   * Cross-tenant platform administration (organisation identity and capability
   * entitlements). The claim is verified by the JWT guard before any handler runs, and
   * the database flag exposes only the tables whose policy opts in.
   */
  async withPlatformAdmin<T>(
    userId: string,
    callback: (tx: TenantPrismaClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`;
        await tx.$executeRaw`SELECT set_config('app.platform_admin', 'true', true)`;
        return callback(tx);
      },
      TRANSACTION_OPTIONS,
    );
  }

  /**
   * Platform support reads: aggregate counts from tenant product tables. This is a
   * deliberately narrow, separately named scope so the policies can grant read-only
   * counts without widening the entitlement-management scope.
   */
  async withPlatformSupport<T>(
    userId: string,
    callback: (tx: TenantPrismaClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`;
        await tx.$executeRaw`SELECT set_config('app.platform_admin', 'true', true)`;
        await tx.$executeRaw`SELECT set_config('app.platform_support', 'true', true)`;
        return callback(tx);
      },
      TRANSACTION_OPTIONS,
    );
  }
}
