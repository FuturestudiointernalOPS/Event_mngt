import { SetMetadata } from '@nestjs/common';

export const TENANT_SCOPE_KEY = 'tenantScope';

/**
 * Which route parameter carries the workspace identifier.
 * `slug` is the normal case (`/workspaces/:slug/...`); `organizationId` is reserved for
 * platform administration endpoints.
 */
export type TenantScopeSource = 'slug' | 'organizationId';

/**
 * Marks a route as tenant-scoped. TenantAccessGuard then resolves the workspace,
 * verifies membership and attaches `request.tenant`. Without this metadata, tenant
 * resolution is skipped — an explicit opt-in keeps the pipeline honest.
 */
export const TenantScoped = (
  source: TenantScopeSource = 'slug',
): MethodDecorator & ClassDecorator => SetMetadata(TENANT_SCOPE_KEY, source);
