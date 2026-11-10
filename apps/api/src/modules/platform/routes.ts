import { CAPABILITY_KEYS } from '@event-platform/shared';
import type { RouteDefinition } from '../../common/routes/route-definition';
import { PlatformOrganizationsController } from './platform-organizations.controller';

export const routes: RouteDefinition[] = [
  {
    method: 'GET',
    path: '/platform/organizations/overview',
    capability: CAPABILITY_KEYS.platformOrganizationsManage,
    handler: { controller: PlatformOrganizationsController, method: 'overview' },
  },
  {
    method: 'GET',
    path: '/platform/organizations/:organizationId',
    capability: CAPABILITY_KEYS.platformOrganizationsManage,
    handler: { controller: PlatformOrganizationsController, method: 'detail' },
  },
  {
    method: 'POST',
    path: '/platform/organizations',
    capability: CAPABILITY_KEYS.platformOrganizationsManage,
    handler: { controller: PlatformOrganizationsController, method: 'create' },
  },
  {
    method: 'PATCH',
    path: '/platform/organizations/:organizationId/status',
    capability: CAPABILITY_KEYS.platformOrganizationsManage,
    handler: { controller: PlatformOrganizationsController, method: 'updateStatus' },
  },
];
