import { PERMISSIONS } from '@event-platform/shared';
import type { RouteDefinition } from '../../common/routes/route-definition';
import { PublicRegistrationsController } from './public-registrations.controller';
import { RegistrationsController } from './registrations.controller';

export const routes: RouteDefinition[] = [
  {
    method: 'GET',
    path: '/workspaces/:slug/events/:eventId/registrations',
    permission: PERMISSIONS.registrationRead,
    handler: { controller: RegistrationsController, method: 'list' },
  },
  {
    method: 'GET',
    path: '/workspaces/:slug/events/:eventId/registrations/:registrationId',
    permission: PERMISSIONS.registrationRead,
    handler: { controller: RegistrationsController, method: 'detail' },
  },
  {
    method: 'POST',
    path: '/workspaces/:slug/events/:eventId/registrations/:registrationId/approve',
    permission: PERMISSIONS.registrationManage,
    handler: { controller: RegistrationsController, method: 'approve' },
  },
  {
    method: 'POST',
    path: '/workspaces/:slug/events/:eventId/registrations/:registrationId/reject',
    permission: PERMISSIONS.registrationManage,
    handler: { controller: RegistrationsController, method: 'reject' },
  },
  {
    method: 'POST',
    path: '/public/events/:eventSlug/registrations',
    permission: null,
    handler: { controller: PublicRegistrationsController, method: 'submit' },
  },
];
