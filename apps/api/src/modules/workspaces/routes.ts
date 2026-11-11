import { CAPABILITY_KEYS } from '@event-platform/shared';
import type { RouteDefinition } from '../../common/routes/route-definition';
import { WorkspacesController } from './workspaces.controller';

export const routes: RouteDefinition[] = [
  {
    method: 'GET',
    path: '/workspaces/:slug/context',
    capability: null,
    handler: { controller: WorkspacesController, method: 'context' },
  },
  {
    method: 'GET',
    path: '/workspaces/:slug/settings',
    capability: CAPABILITY_KEYS.organizationView,
    handler: { controller: WorkspacesController, method: 'settings' },
  },
  {
    method: 'PATCH',
    path: '/workspaces/:slug/settings',
    capability: CAPABILITY_KEYS.organizationEdit,
    handler: { controller: WorkspacesController, method: 'updateSettings' },
  },
  {
    method: 'GET',
    path: '/workspaces/:slug/branding',
    capability: CAPABILITY_KEYS.organizationView,
    handler: { controller: WorkspacesController, method: 'branding' },
  },
  {
    method: 'PATCH',
    path: '/workspaces/:slug/branding',
    capability: CAPABILITY_KEYS.organizationManageBranding,
    handler: { controller: WorkspacesController, method: 'updateBranding' },
  },
  {
    method: 'POST',
    path: '/workspaces/:slug/branding/assets/:kind',
    capability: CAPABILITY_KEYS.organizationManageBranding,
    handler: { controller: WorkspacesController, method: 'uploadBrandAsset' },
  },
];
