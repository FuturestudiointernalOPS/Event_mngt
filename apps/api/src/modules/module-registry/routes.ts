import { CAPABILITY_KEYS } from '@event-platform/shared';
import type { RouteDefinition } from '../../common/routes/route-definition';
import { ModuleRegistryController } from './module-registry.controller';

export const routes: RouteDefinition[] = [
  {
    method: 'GET',
    path: '/modules',
    capability: null,
    handler: { controller: ModuleRegistryController, method: 'catalogue' },
  },
  {
    method: 'GET',
    path: '/workspaces/:slug/events/:eventId/modules',
    capability: CAPABILITY_KEYS.eventsViewModules,
    handler: { controller: ModuleRegistryController, method: 'list' },
  },
  {
    method: 'PATCH',
    path: '/workspaces/:slug/events/:eventId/modules',
    capability: CAPABILITY_KEYS.eventsManageModules,
    handler: { controller: ModuleRegistryController, method: 'update' },
  },
];
