import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { hasPermission } from '@event-platform/shared';
import { AppException } from '../app-exception';
import { REQUIRED_PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import type { AuthenticatedRequest } from '../types/authenticated-request';

/**
 * Enforces @RequirePermissions() against the permissions resolved from the caller's
 * membership. The API is the authority; hiding a control in the UI is not a control.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(REQUIRED_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const tenant = request.tenant;

    if (!tenant) {
      throw AppException.forbidden(
        'permission_denied',
        'This action requires a workspace membership.',
      );
    }

    if (!hasPermission(tenant.permissions, required)) {
      throw AppException.forbidden(
        'permission_denied',
        'You do not have permission to perform this action.',
      );
    }

    return true;
  }
}
