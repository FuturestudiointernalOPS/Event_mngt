import { PERMISSIONS } from '@event-platform/shared';
import type { RouteDefinition } from '../../common/routes/route-definition';
import { CheckInsController } from './check-ins.controller';

export const routes: RouteDefinition[] = [
  {
    method: 'POST',
    path: '/workspaces/:slug/events/:eventId/check-ins',
    permission: PERMISSIONS.checkinOperate,
    handler: { controller: CheckInsController, method: 'record' },
  },
  {
    method: 'POST',
    path: '/workspaces/:slug/events/:eventId/check-ins/sync',
    permission: PERMISSIONS.checkinOperate,
    handler: { controller: CheckInsController, method: 'sync' },
  },
  {
    method: 'GET',
    path: '/workspaces/:slug/events/:eventId/check-ins',
    permission: PERMISSIONS.checkinRead,
    handler: { controller: CheckInsController, method: 'list' },
  },
  {
    method: 'GET',
    path: '/workspaces/:slug/events/:eventId/check-ins/summary',
    permission: PERMISSIONS.checkinRead,
    handler: { controller: CheckInsController, method: 'summary' },
  },
];
