import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest } from '../types/authenticated-request';
import type { TenantAccess } from '../types/authenticated-user';

/**
 * Injects the tenant resolved by TenantAccessGuard. Use on routes decorated with
 * @TenantScoped(). Services still take the organisation id from the tenant context
 * rather than trusting this value as authority.
 */
export const CurrentTenant = createParamDecorator(
  (_data: unknown, context: ExecutionContext): TenantAccess => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.tenant) {
      throw new Error('CurrentTenant used on a route without @TenantScoped()');
    }
    return request.tenant;
  },
);
