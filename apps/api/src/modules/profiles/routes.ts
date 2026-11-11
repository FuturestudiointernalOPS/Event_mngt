import { CAPABILITY_KEYS } from '@event-platform/shared';
import type { RouteDefinition } from '../../common/routes/route-definition';
import { OrganizationProfileController } from './organization-profile.controller';
import { ParticipantProfilesController } from './participant-profiles.controller';
import { PublicShowcaseController } from './public-showcase.controller';
import { ShowcaseController } from './showcase.controller';

export const routes: RouteDefinition[] = [
  {
    method: 'GET',
    path: '/workspaces/:slug/events/:eventId/profiles',
    capability: CAPABILITY_KEYS.profilesView,
    handler: { controller: ParticipantProfilesController, method: 'list' },
  },
  {
    method: 'GET',
    path: '/workspaces/:slug/events/:eventId/profiles/:profileId',
    capability: CAPABILITY_KEYS.profilesView,
    handler: { controller: ParticipantProfilesController, method: 'detail' },
  },
  {
    method: 'PUT',
    path: '/workspaces/:slug/events/:eventId/registrations/:registrationId/profile',
    capability: CAPABILITY_KEYS.profilesEdit,
    handler: { controller: ParticipantProfilesController, method: 'upsert' },
  },
  {
    method: 'PATCH',
    path: '/workspaces/:slug/events/:eventId/profiles/:profileId',
    capability: CAPABILITY_KEYS.profilesEdit,
    handler: { controller: ParticipantProfilesController, method: 'update' },
  },
  {
    method: 'POST',
    path: '/workspaces/:slug/events/:eventId/profiles/:profileId/moderate',
    capability: CAPABILITY_KEYS.profilesModerate,
    handler: { controller: ParticipantProfilesController, method: 'moderate' },
  },
  {
    method: 'GET',
    path: '/workspaces/:slug/organization-profile',
    capability: CAPABILITY_KEYS.profilesView,
    handler: { controller: OrganizationProfileController, method: 'get' },
  },
  {
    method: 'PUT',
    path: '/workspaces/:slug/organization-profile',
    capability: CAPABILITY_KEYS.organizationEdit,
    handler: { controller: OrganizationProfileController, method: 'upsert' },
  },
  {
    method: 'POST',
    path: '/workspaces/:slug/organization-profile/moderate',
    capability: CAPABILITY_KEYS.profilesModerate,
    handler: { controller: OrganizationProfileController, method: 'moderate' },
  },
  {
    method: 'GET',
    path: '/workspaces/:slug/events/:eventId/showcase',
    capability: CAPABILITY_KEYS.profilesView,
    handler: { controller: ShowcaseController, method: 'list' },
  },
  {
    method: 'POST',
    path: '/workspaces/:slug/events/:eventId/showcase',
    capability: CAPABILITY_KEYS.profilesEdit,
    handler: { controller: ShowcaseController, method: 'create' },
  },
  {
    method: 'POST',
    path: '/workspaces/:slug/events/:eventId/showcase/:innovationId/moderate',
    capability: CAPABILITY_KEYS.profilesModerate,
    handler: { controller: ShowcaseController, method: 'moderate' },
  },
  {
    method: 'GET',
    path: '/public/events/:eventSlug/showcase',
    capability: null,
    handler: { controller: PublicShowcaseController, method: 'get' },
  },
];
