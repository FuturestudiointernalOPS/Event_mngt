import { CAPABILITY_KEYS } from '@event-platform/shared';
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
    capability: CAPABILITY_KEYS.introductionsView,
    handler: { controller: IntroductionsController, method: 'list' },
  },
  {
    method: 'POST',
    path: '/workspaces/:slug/events/:eventId/introductions',
    capability: CAPABILITY_KEYS.introductionsManage,
    handler: { controller: IntroductionsController, method: 'create' },
  },
  {
    method: 'GET',
    path: '/workspaces/:slug/events/:eventId/introductions/:introductionId',
    capability: CAPABILITY_KEYS.introductionsView,
    handler: { controller: IntroductionsController, method: 'detail' },
  },
  {
    method: 'PATCH',
    path: '/workspaces/:slug/events/:eventId/introductions/:introductionId',
    capability: CAPABILITY_KEYS.introductionsManage,
    handler: { controller: IntroductionsController, method: 'update' },
  },
];
