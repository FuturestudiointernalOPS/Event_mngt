import { CAPABILITY_KEYS } from '@event-platform/shared';
import type { RouteDefinition } from '../../common/routes/route-definition';
import { PublicRegistrationsController } from './public-registrations.controller';
import { RegistrationsController } from './registrations.controller';

export const routes: RouteDefinition[] = [
  {
    method: 'GET',
    path: '/workspaces/:slug/events/:eventId/registrations',
    capability: CAPABILITY_KEYS.registrationsView,
    handler: { controller: RegistrationsController, method: 'list' },
  },
  {
    method: 'GET',
    path: '/workspaces/:slug/events/:eventId/registrations/:registrationId',
    capability: CAPABILITY_KEYS.registrationsView,
    handler: { controller: RegistrationsController, method: 'detail' },
  },
  {
    method: 'POST',
    path: '/workspaces/:slug/events/:eventId/registrations/:registrationId/approve',
    capability: CAPABILITY_KEYS.registrationsApprove,
    handler: { controller: RegistrationsController, method: 'approve' },
  },
  {
    method: 'POST',
    path: '/workspaces/:slug/events/:eventId/registrations/:registrationId/reject',
    capability: CAPABILITY_KEYS.registrationsReject,
    handler: { controller: RegistrationsController, method: 'reject' },
  },
  {
    method: 'POST',
    path: '/workspaces/:slug/events/:eventId/registrations/:registrationId/erase',
    capability: CAPABILITY_KEYS.registrationsErase,
    handler: { controller: RegistrationsController, method: 'erase' },
  },
  {
    method: 'POST',
    path: '/public/events/:eventSlug/registrations',
    capability: null,
    handler: { controller: PublicRegistrationsController, method: 'submit' },
  },
];
