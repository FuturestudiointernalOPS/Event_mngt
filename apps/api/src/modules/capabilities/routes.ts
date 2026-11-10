import { CAPABILITY_KEYS } from '@event-platform/shared';
import type { RouteDefinition } from '../../common/routes/route-definition';
import { CapabilitiesController } from './capabilities.controller';
import { PlatformCapabilitiesController } from './platform-capabilities.controller';

export const routes: RouteDefinition[] = [
  {
    method: 'GET',
    path: '/workspaces/:slug/me/capabilities',
    capability: null,
    handler: { controller: CapabilitiesController, method: 'self' },
  },
  {
    method: 'GET',
    path: '/workspaces/:slug/capabilities',
    capability: CAPABILITY_KEYS.organizationViewMembers,
    handler: { controller: CapabilitiesController, method: 'organization' },
  },
  {
    method: 'GET',
    path: '/workspaces/:slug/members/:memberId/capabilities',
    capability: CAPABILITY_KEYS.organizationViewMembers,
    handler: { controller: CapabilitiesController, method: 'member' },
  },
  {
    method: 'PUT',
    path: '/workspaces/:slug/members/:memberId/capabilities/:capabilityKey',
    capability: CAPABILITY_KEYS.organizationManagePermissions,
    handler: { controller: CapabilitiesController, method: 'grant' },
  },
  {
    method: 'DELETE',
    path: '/workspaces/:slug/members/:memberId/capabilities/:capabilityKey',
    capability: CAPABILITY_KEYS.organizationManagePermissions,
    handler: { controller: CapabilitiesController, method: 'revoke' },
  },
  {
    method: 'GET',
    path: '/platform/capabilities',
    capability: CAPABILITY_KEYS.platformCapabilitiesView,
    handler: { controller: PlatformCapabilitiesController, method: 'catalogue' },
  },
  {
    method: 'GET',
    path: '/platform/organizations',
    capability: CAPABILITY_KEYS.platformOrganizationsManage,
    handler: { controller: PlatformCapabilitiesController, method: 'organizations' },
  },
  {
    method: 'GET',
    path: '/platform/organizations/:organizationId/capabilities',
    capability: CAPABILITY_KEYS.platformOrganizationsManage,
    handler: { controller: PlatformCapabilitiesController, method: 'organization' },
  },
  {
    method: 'PUT',
    path: '/platform/organizations/:organizationId/capabilities/:capabilityKey',
    capability: CAPABILITY_KEYS.platformOrganizationsManage,
    handler: { controller: PlatformCapabilitiesController, method: 'grant' },
  },
  {
    method: 'DELETE',
    path: '/platform/organizations/:organizationId/capabilities/:capabilityKey',
    capability: CAPABILITY_KEYS.platformOrganizationsManage,
    handler: { controller: PlatformCapabilitiesController, method: 'revoke' },
  },
];
