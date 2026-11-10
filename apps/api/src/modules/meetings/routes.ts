import { PERMISSIONS } from '@event-platform/shared';
import type { RouteDefinition } from '../../common/routes/route-definition';
import { MeetingsController } from './meetings.controller';

export const routes: RouteDefinition[] = [
  {
    method: 'GET',
    path: '/workspaces/:slug/events/:eventId/meetings',
    permission: PERMISSIONS.meetingRead,
    handler: { controller: MeetingsController, method: 'list' },
  },
  {
    method: 'POST',
    path: '/workspaces/:slug/events/:eventId/meetings',
    permission: PERMISSIONS.meetingManage,
    handler: { controller: MeetingsController, method: 'propose' },
  },
  {
    method: 'PATCH',
    path: '/workspaces/:slug/events/:eventId/meetings/:meetingId',
    permission: PERMISSIONS.meetingManage,
    handler: { controller: MeetingsController, method: 'update' },
  },
];
