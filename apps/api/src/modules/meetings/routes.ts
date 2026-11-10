import { CAPABILITY_KEYS } from '@event-platform/shared';
import type { RouteDefinition } from '../../common/routes/route-definition';
import { MeetingsController } from './meetings.controller';

export const routes: RouteDefinition[] = [
  {
    method: 'GET',
    path: '/workspaces/:slug/events/:eventId/meetings',
    capability: CAPABILITY_KEYS.meetingsView,
    handler: { controller: MeetingsController, method: 'list' },
  },
  {
    method: 'POST',
    path: '/workspaces/:slug/events/:eventId/meetings',
    capability: CAPABILITY_KEYS.meetingsManage,
    handler: { controller: MeetingsController, method: 'propose' },
  },
  {
    method: 'PATCH',
    path: '/workspaces/:slug/events/:eventId/meetings/:meetingId',
    capability: CAPABILITY_KEYS.meetingsManage,
    handler: { controller: MeetingsController, method: 'update' },
  },
];
