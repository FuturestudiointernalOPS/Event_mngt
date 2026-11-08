import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsService } from '../../modules/permissions/permissions.service';
import { AppException } from '../app-exception';
import {
  TENANT_SCOPE_KEY,
  TenantScopeSource,
} from '../decorators/tenant-scoped.decorator';
import type { AuthenticatedRequest } from '../types/authenticated-request';

/**
 * Resolves the tenant from a verified membership.
 *
 * The workspace is identified by the route parameter stated in @TenantScoped().
 * An organization identifier supplied in a body, query string or client header is
 * ignored: see docs/03-tenant-isolation-and-rls.md.
 */
@Injectable()
export class TenantAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionsService: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const source = this.reflector.getAllAndOverride<TenantScopeSource | undefined>(
      TENANT_SCOPE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!source) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.user) {
      throw AppException.unauthorized('unauthorized', 'Sign in to continue.');
    }

    const identifier = request.params[source];

    if (typeof identifier !== 'string' || identifier.length === 0) {
      throw AppException.badRequest(
        'tenant_not_resolved',
        'The workspace identifier is missing from the request.',
      );
    }

    request.tenant =
      source === 'slug'
        ? await this.permissionsService.resolveTenantAccessBySlug(request.user.id, identifier)
        : await this.permissionsService.resolveTenantAccessById(request.user.id, identifier);

    return true;
  }
}
