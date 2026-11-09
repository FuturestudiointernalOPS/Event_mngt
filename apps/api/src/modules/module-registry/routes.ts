import { PERMISSIONS } from '@event-platform/shared';
import type { RouteDefinition } from '../../common/routes/route-definition';
import { ModuleRegistryController } from './module-registry.controller';

export const routes: RouteDefinition[] = [
  {
    method: 'GET',
    path: '/modules',
    permission: null,
    handler: { controller: ModuleRegistryController, method: 'catalogue' },
  },
  {
    method: 'GET',
    path: '/workspaces/:slug/events/:eventId/modules',
    permission: PERMISSIONS.eventRead,
    handler: { controller: ModuleRegistryController, method: 'list' },
  },
  {
    method: 'PATCH',
    path: '/workspaces/:slug/events/:eventId/modules',
    permission: PERMISSIONS.moduleManage,
    handler: { controller: ModuleRegistryController, method: 'update' },
  },
];
