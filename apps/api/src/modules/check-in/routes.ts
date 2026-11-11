import { CAPABILITY_KEYS } from '@event-platform/shared';
import type { RouteDefinition } from '../../common/routes/route-definition';
import { CheckInsController } from './check-ins.controller';

export const routes: RouteDefinition[] = [
  {
    method: 'POST',
    path: '/workspaces/:slug/events/:eventId/check-ins',
    capability: CAPABILITY_KEYS.checkInOperate,
    handler: { controller: CheckInsController, method: 'record' },
  },
  {
    method: 'POST',
    path: '/workspaces/:slug/events/:eventId/check-ins/sync',
    capability: CAPABILITY_KEYS.checkInOperate,
    handler: { controller: CheckInsController, method: 'sync' },
  },
  {
    method: 'GET',
    path: '/workspaces/:slug/events/:eventId/check-ins',
    capability: CAPABILITY_KEYS.checkInView,
    handler: { controller: CheckInsController, method: 'list' },
  },
  {
    method: 'GET',
    path: '/workspaces/:slug/events/:eventId/check-ins/summary',
    capability: CAPABILITY_KEYS.checkInView,
    handler: { controller: CheckInsController, method: 'summary' },
  },
];
