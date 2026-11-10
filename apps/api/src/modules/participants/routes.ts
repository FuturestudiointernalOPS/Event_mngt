import { PERMISSIONS } from '@event-platform/shared';
import type { RouteDefinition } from '../../common/routes/route-definition';
import { ParticipantsController } from './participants.controller';

export const routes: RouteDefinition[] = [
  {
    method: 'GET',
    path: '/workspaces/:slug/events/:eventId/participants',
    permission: PERMISSIONS.participantRead,
    handler: { controller: ParticipantsController, method: 'list' },
  },
  {
    method: 'GET',
    path: '/workspaces/:slug/events/:eventId/participants/:personId',
    permission: PERMISSIONS.participantRead,
    handler: { controller: ParticipantsController, method: 'detail' },
  },
];
