import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { getCapabilityDefinition } from '@event-platform/shared';
import { AppException } from '../app-exception';
import { REQUIRED_CAPABILITIES_KEY } from '../decorators/require-capability.decorator';
import type { AuthenticatedRequest } from '../types/authenticated-request';

/**
 * The single authorization gate for protected routes.
 *
 * Tenant capabilities are checked against `request.tenant.capabilities`, already
 * reduced to organisation entitlement ∩ member grants (role and direct) with
 * dependencies applied. Platform-scoped capabilities check the platform administrator
 * flag, because they deliberately cross tenants.
 *
 * Default deny: an unknown capability, a missing membership or an empty effective set
 * all fail closed.
 */
@Injectable()
export class CapabilityGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(REQUIRED_CAPABILITIES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const definitions = required.map((key) => ({ key, definition: getCapabilityDefinition(key) }));

    const unknown = definitions.filter(({ definition }) => definition === undefined);
    if (unknown.length > 0) {
      throw AppException.forbidden(
        'unknown_capability',
        'This action is not configured correctly.',
        { capabilities: unknown.map(({ key }) => key) },
      );
    }

    const platformRequired = definitions.filter(
      ({ definition }) => definition?.scope === 'platform',
    );
    const tenantRequired = definitions.filter(
      ({ definition }) => definition?.scope !== 'platform',
    );

    if (platformRequired.length > 0 && request.user?.isPlatformAdmin !== true) {
      throw AppException.forbidden(
        'platform_admin_required',
        'This action is reserved for platform administrators.',
      );
    }

    if (tenantRequired.length === 0) {
      return true;
    }

    const tenant = request.tenant;

    if (!tenant) {
      throw AppException.forbidden(
        'capability_denied',
        'This action requires a workspace membership.',
      );
    }

    const granted = new Set(tenant.capabilities);
    const missing = tenantRequired
      .map(({ key }) => key)
      .filter((key) => !granted.has(key));

    if (missing.length > 0) {
      throw AppException.forbidden(
        'capability_denied',
        'You do not have permission to perform this action.',
        { capabilities: missing },
      );
    }

    return true;
  }
}
