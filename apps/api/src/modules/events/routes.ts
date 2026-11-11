import { CAPABILITY_KEYS } from '@event-platform/shared';
import type { RouteDefinition } from '../../common/routes/route-definition';
import { EditionsController } from './editions.controller';
import { EventsController } from './events.controller';
import { PublicEventsController } from './public-events.controller';

/** Tenant event routes, editions, and the public projection — one module, nine routes. */
export const routes: RouteDefinition[] = [
  {
    method: 'GET',
    path: '/workspaces/:slug/events',
    capability: CAPABILITY_KEYS.eventsView,
    handler: { controller: EventsController, method: 'list' },
  },
  {
    method: 'POST',
    path: '/workspaces/:slug/events',
    capability: CAPABILITY_KEYS.eventsCreate,
    handler: { controller: EventsController, method: 'create' },
  },
  {
    method: 'GET',
    path: '/workspaces/:slug/events/:eventId',
    capability: CAPABILITY_KEYS.eventsView,
    handler: { controller: EventsController, method: 'detail' },
  },
  {
    method: 'POST',
    path: '/workspaces/:slug/events/:eventId/publish',
    capability: CAPABILITY_KEYS.eventsPublish,
    handler: { controller: EventsController, method: 'publish' },
  },
  {
    method: 'POST',
    path: '/workspaces/:slug/events/:eventId/banner',
    capability: CAPABILITY_KEYS.eventsCreate,
    handler: { controller: EventsController, method: 'uploadBanner' },
  },
  {
    method: 'PATCH',
    path: '/workspaces/:slug/events/:eventId',
    capability: CAPABILITY_KEYS.eventsCreate,
    handler: { controller: EventsController, method: 'update' },
  },
  {
    method: 'POST',
    path: '/workspaces/:slug/events/:eventId/transitions',
    capability: CAPABILITY_KEYS.eventsPublish,
    handler: { controller: EventsController, method: 'transition' },
  },
  {
    method: 'POST',
    path: '/workspaces/:slug/events/:eventId/duplicate',
    capability: CAPABILITY_KEYS.eventsCreate,
    handler: { controller: EventsController, method: 'duplicate' },
  },
  {
    method: 'GET',
    path: '/workspaces/:slug/events/:eventId/editions',
    capability: CAPABILITY_KEYS.editionsView,
    handler: { controller: EditionsController, method: 'list' },
  },
  {
    method: 'POST',
    path: '/workspaces/:slug/events/:eventId/editions',
    capability: CAPABILITY_KEYS.editionsCreate,
    handler: { controller: EditionsController, method: 'create' },
  },
  {
    method: 'GET',
    path: '/workspaces/:slug/events/:eventId/editions/:editionId',
    capability: CAPABILITY_KEYS.editionsView,
    handler: { controller: EditionsController, method: 'detail' },
  },
  {
    method: 'GET',
    path: '/public/events/:eventSlug/context',
    capability: null,
    handler: { controller: PublicEventsController, method: 'context' },
  },
  {
    method: 'GET',
    path: '/public/events/:eventSlug',
    capability: null,
    handler: { controller: PublicEventsController, method: 'detail' },
  },
];
