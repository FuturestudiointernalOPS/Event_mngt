import { PERMISSIONS } from '@event-platform/shared';
import type { RouteDefinition } from '../../common/routes/route-definition';
import { ConsentController } from './consent.controller';

export const routes: RouteDefinition[] = [
  {
    method: 'GET',
    path: '/workspaces/:slug/events/:eventId/consent-documents',
    permission: PERMISSIONS.registrationRead,
    handler: { controller: ConsentController, method: 'list' },
  },
  {
    method: 'POST',
    path: '/workspaces/:slug/events/:eventId/consent-documents',
    permission: PERMISSIONS.registrationManage,
    handler: { controller: ConsentController, method: 'create' },
  },
];
