import { CAPABILITY_KEYS } from '@event-platform/shared';
import type { RouteDefinition } from '../../common/routes/route-definition';
import { ParticipantsController } from './participants.controller';

export const routes: RouteDefinition[] = [
  {
    method: 'GET',
    path: '/workspaces/:slug/events/:eventId/participants',
    capability: CAPABILITY_KEYS.participantsView,
    handler: { controller: ParticipantsController, method: 'list' },
  },
  {
    method: 'GET',
    path: '/workspaces/:slug/events/:eventId/participants/:personId',
    capability: CAPABILITY_KEYS.participantsView,
    handler: { controller: ParticipantsController, method: 'detail' },
  },
];
