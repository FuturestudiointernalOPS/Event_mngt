import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * The resolved tenant for the current request (or job).
 *
 * Populated by TenantContextInterceptor from `request.tenant`, which in turn is
 * populated by TenantAccessGuard from a verified membership. It is never built from
 * a client-supplied organizationId.
 */
export interface TenantContext {
  organizationId: string;
  userId: string;
  membershipId: string;
  permissions: string[];
  /** Correlation and origin of the request, when there is one (not set for jobs). */
  requestId?: string;
  ipAddress?: string;
}

@Injectable()
export class TenantContextService {
  private readonly storage = new AsyncLocalStorage<TenantContext>();

  /**
   * Runs `callback` with the given tenant context bound to the async scope.
   * Background jobs use this to re-enter a tenant deliberately.
   */
  run<T>(context: TenantContext, callback: () => T): T {
    return this.storage.run(context, callback);
  }

  get(): TenantContext | undefined {
    return this.storage.getStore();
  }

  /**
   * Fails loudly instead of silently querying without tenant scoping.
   */
  getOrThrow(): TenantContext {
    const context = this.get();
    if (!context) {
      throw new Error(
        'Tenant context is not available. Tenant-owned queries must run inside ' +
          'TenantTransactionService.withTenant (or TenantContextService.run for jobs).',
      );
    }
    return context;
  }
}
