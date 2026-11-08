import { SetMetadata } from '@nestjs/common';

export const REQUIRED_PERMISSIONS_KEY = 'requiredPermissions';

/**
 * Declares the permissions required to call a route. Enforced by PermissionsGuard
 * against the permissions resolved from the caller's membership — never from the
 * token or from client input.
 *
 * Use permission constants from `@event-platform/shared`:
 *   @RequirePermissions(PERMISSIONS.eventManage)
 */
export const RequirePermissions = (
  ...permissions: string[]
): MethodDecorator & ClassDecorator => SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);
