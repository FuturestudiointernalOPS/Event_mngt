import { PERMISSIONS } from '@event-platform/shared';
import type { RouteDefinition } from '../../common/routes/route-definition';
import { BadgesController } from './badges.controller';

export const routes: RouteDefinition[] = [
  {
    method: 'GET',
    path: '/workspaces/:slug/events/:eventId/badges',
    permission: PERMISSIONS.registrationRead,
    handler: { controller: BadgesController, method: 'list' },
  },
  {
    method: 'GET',
    path: '/workspaces/:slug/events/:eventId/registrations/:registrationId/badge',
    permission: PERMISSIONS.registrationRead,
    handler: { controller: BadgesController, method: 'detail' },
  },
  {
    method: 'POST',
    path: '/workspaces/:slug/events/:eventId/registrations/:registrationId/badge/reissue',
    permission: PERMISSIONS.registrationManage,
    handler: { controller: BadgesController, method: 'reissue' },
  },
  {
    method: 'POST',
    path: '/workspaces/:slug/events/:eventId/registrations/:registrationId/badge/revoke',
    permission: PERMISSIONS.registrationManage,
    handler: { controller: BadgesController, method: 'revoke' },
  },
];
