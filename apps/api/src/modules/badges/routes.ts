import { CAPABILITY_KEYS } from '@event-platform/shared';
import type { RouteDefinition } from '../../common/routes/route-definition';
import { BadgesController } from './badges.controller';

export const routes: RouteDefinition[] = [
  {
    method: 'GET',
    path: '/workspaces/:slug/events/:eventId/badges',
    capability: CAPABILITY_KEYS.registrationsViewBadges,
    handler: { controller: BadgesController, method: 'list' },
  },
  {
    method: 'GET',
    path: '/workspaces/:slug/events/:eventId/registrations/:registrationId/badge',
    capability: CAPABILITY_KEYS.registrationsViewBadges,
    handler: { controller: BadgesController, method: 'detail' },
  },
  {
    method: 'POST',
    path: '/workspaces/:slug/events/:eventId/registrations/:registrationId/badge/reissue',
    capability: CAPABILITY_KEYS.registrationsManageBadges,
    handler: { controller: BadgesController, method: 'reissue' },
  },
  {
    method: 'POST',
    path: '/workspaces/:slug/events/:eventId/registrations/:registrationId/badge/revoke',
    capability: CAPABILITY_KEYS.registrationsManageBadges,
    handler: { controller: BadgesController, method: 'revoke' },
  },
];
