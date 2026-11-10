import { CAPABILITY_KEYS } from '@event-platform/shared';
import type { RouteDefinition } from '../../common/routes/route-definition';
import { ConsentController } from './consent.controller';

export const routes: RouteDefinition[] = [
  {
    method: 'GET',
    path: '/workspaces/:slug/events/:eventId/consent-documents',
    capability: CAPABILITY_KEYS.registrationsViewConsent,
    handler: { controller: ConsentController, method: 'list' },
  },
  {
    method: 'POST',
    path: '/workspaces/:slug/events/:eventId/consent-documents',
    capability: CAPABILITY_KEYS.registrationsManageConsent,
    handler: { controller: ConsentController, method: 'create' },
  },
];
