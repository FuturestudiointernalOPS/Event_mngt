import { PERMISSIONS } from '@event-platform/shared';
import type { RouteDefinition } from '../../common/routes/route-definition';
import { WorkspacesController } from './workspaces.controller';

export const routes: RouteDefinition[] = [
  {
    method: 'GET',
    path: '/workspaces/:slug/context',
    permission: null,
    handler: { controller: WorkspacesController, method: 'context' },
  },
  {
    method: 'GET',
    path: '/workspaces/:slug/settings',
    permission: PERMISSIONS.workspaceRead,
    handler: { controller: WorkspacesController, method: 'settings' },
  },
  {
    method: 'PATCH',
    path: '/workspaces/:slug/settings',
    permission: PERMISSIONS.workspaceManage,
    handler: { controller: WorkspacesController, method: 'updateSettings' },
  },
  {
    method: 'GET',
    path: '/workspaces/:slug/branding',
    permission: PERMISSIONS.workspaceRead,
    handler: { controller: WorkspacesController, method: 'branding' },
  },
  {
    method: 'PATCH',
    path: '/workspaces/:slug/branding',
    permission: PERMISSIONS.workspaceManage,
    handler: { controller: WorkspacesController, method: 'updateBranding' },
  },
  {
    method: 'POST',
    path: '/workspaces/:slug/branding/assets/:kind',
    permission: PERMISSIONS.workspaceManage,
    handler: { controller: WorkspacesController, method: 'uploadBrandAsset' },
  },
];
