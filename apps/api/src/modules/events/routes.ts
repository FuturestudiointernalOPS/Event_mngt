import { PERMISSIONS } from '@event-platform/shared';
import type { RouteDefinition } from '../../common/routes/route-definition';
import { EditionsController } from './editions.controller';
import { EventsController } from './events.controller';
import { PublicEventsController } from './public-events.controller';

/** Tenant event routes, editions, and the public projection — one module, ten routes. */
export const routes: RouteDefinition[] = [
  {
    method: 'GET',
    path: '/workspaces/:slug/events',
    permission: PERMISSIONS.eventRead,
    handler: { controller: EventsController, method: 'list' },
  },
  {
    method: 'POST',
    path: '/workspaces/:slug/events',
    permission: PERMISSIONS.eventManage,
    handler: { controller: EventsController, method: 'create' },
  },
  {
    method: 'GET',
    path: '/workspaces/:slug/events/:eventId',
    permission: PERMISSIONS.eventRead,
    handler: { controller: EventsController, method: 'detail' },
  },
  {
    method: 'POST',
    path: '/workspaces/:slug/events/:eventId/publish',
    permission: PERMISSIONS.eventPublish,
    handler: { controller: EventsController, method: 'publish' },
  },
  {
    method: 'GET',
    path: '/workspaces/:slug/events/:eventId/editions',
    permission: PERMISSIONS.eventRead,
    handler: { controller: EditionsController, method: 'list' },
  },
  {
    method: 'POST',
    path: '/workspaces/:slug/events/:eventId/editions',
    permission: PERMISSIONS.eventManage,
    handler: { controller: EditionsController, method: 'create' },
  },
  {
    method: 'GET',
    path: '/workspaces/:slug/events/:eventId/editions/:editionId',
    permission: PERMISSIONS.eventRead,
    handler: { controller: EditionsController, method: 'detail' },
  },
  {
    method: 'GET',
    path: '/public/events/:eventSlug/context',
    permission: null,
    handler: { controller: PublicEventsController, method: 'context' },
  },
  {
    method: 'GET',
    path: '/public/events/:eventSlug',
    permission: null,
    handler: { controller: PublicEventsController, method: 'detail' },
  },
];
