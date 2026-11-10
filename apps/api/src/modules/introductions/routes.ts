import { PERMISSIONS } from '@event-platform/shared';
import type { RouteDefinition } from '../../common/routes/route-definition';
import { IntroductionsController } from './introductions.controller';

/**
 * The history has no route of its own: it is returned with the detail and there is
 * deliberately no update or delete path for a history row.
 */
export const routes: RouteDefinition[] = [
  {
    method: 'GET',
    path: '/workspaces/:slug/events/:eventId/introductions',
    permission: PERMISSIONS.introductionRead,
    handler: { controller: IntroductionsController, method: 'list' },
  },
  {
    method: 'POST',
    path: '/workspaces/:slug/events/:eventId/introductions',
    permission: PERMISSIONS.introductionManage,
    handler: { controller: IntroductionsController, method: 'create' },
  },
  {
    method: 'GET',
    path: '/workspaces/:slug/events/:eventId/introductions/:introductionId',
    permission: PERMISSIONS.introductionRead,
    handler: { controller: IntroductionsController, method: 'detail' },
  },
  {
    method: 'PATCH',
    path: '/workspaces/:slug/events/:eventId/introductions/:introductionId',
    permission: PERMISSIONS.introductionManage,
    handler: { controller: IntroductionsController, method: 'update' },
  },
];
