import type { TenantContext } from '../../database/tenant-context.service';
import type { AuthenticatedRequest } from '../types/authenticated-request';

/**
 * The namespace a key belongs to.
 *
 * Keys are scoped so the same value cannot collide across tenants, accounts or public
 * routes. A tenant scope is the organisation resolved from the membership, never a
 * client-supplied id.
 */
export function idempotencyScope(
  request: AuthenticatedRequest,
  tenant: TenantContext | undefined,
): string {
  if (tenant) {
    return `org:${tenant.organizationId}`;
  }

  if (request.user) {
    return `user:${request.user.id}`;
  }

  const route = request.route?.path ?? request.path ?? 'unknown';
  return `anon:${request.method}:${route}:${request.ip ?? 'unknown'}`;
}
