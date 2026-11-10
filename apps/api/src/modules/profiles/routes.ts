import { PERMISSIONS } from '@event-platform/shared';
import type { RouteDefinition } from '../../common/routes/route-definition';
import { OrganizationProfileController } from './organization-profile.controller';
import { ParticipantProfilesController } from './participant-profiles.controller';
import { PublicShowcaseController } from './public-showcase.controller';
import { ShowcaseController } from './showcase.controller';

export const routes: RouteDefinition[] = [
  {
    method: 'GET',
    path: '/workspaces/:slug/events/:eventId/profiles',
    permission: PERMISSIONS.profileRead,
    handler: { controller: ParticipantProfilesController, method: 'list' },
  },
  {
    method: 'GET',
    path: '/workspaces/:slug/events/:eventId/profiles/:profileId',
    permission: PERMISSIONS.profileRead,
    handler: { controller: ParticipantProfilesController, method: 'detail' },
  },
  {
    method: 'PUT',
    path: '/workspaces/:slug/events/:eventId/registrations/:registrationId/profile',
    permission: PERMISSIONS.registrationManage,
    handler: { controller: ParticipantProfilesController, method: 'upsert' },
  },
  {
    method: 'PATCH',
    path: '/workspaces/:slug/events/:eventId/profiles/:profileId',
    permission: PERMISSIONS.registrationManage,
    handler: { controller: ParticipantProfilesController, method: 'update' },
  },
  {
    method: 'POST',
    path: '/workspaces/:slug/events/:eventId/profiles/:profileId/moderate',
    permission: PERMISSIONS.profileModerate,
    handler: { controller: ParticipantProfilesController, method: 'moderate' },
  },
  {
    method: 'GET',
    path: '/workspaces/:slug/organization-profile',
    permission: PERMISSIONS.profileRead,
    handler: { controller: OrganizationProfileController, method: 'get' },
  },
  {
    method: 'PUT',
    path: '/workspaces/:slug/organization-profile',
    permission: PERMISSIONS.workspaceManage,
    handler: { controller: OrganizationProfileController, method: 'upsert' },
  },
  {
    method: 'POST',
    path: '/workspaces/:slug/organization-profile/moderate',
    permission: PERMISSIONS.profileModerate,
    handler: { controller: OrganizationProfileController, method: 'moderate' },
  },
  {
    method: 'GET',
    path: '/workspaces/:slug/events/:eventId/showcase',
    permission: PERMISSIONS.profileRead,
    handler: { controller: ShowcaseController, method: 'list' },
  },
  {
    method: 'POST',
    path: '/workspaces/:slug/events/:eventId/showcase',
    permission: PERMISSIONS.registrationManage,
    handler: { controller: ShowcaseController, method: 'create' },
  },
  {
    method: 'POST',
    path: '/workspaces/:slug/events/:eventId/showcase/:innovationId/moderate',
    permission: PERMISSIONS.profileModerate,
    handler: { controller: ShowcaseController, method: 'moderate' },
  },
  {
    method: 'GET',
    path: '/public/events/:eventSlug/showcase',
    permission: null,
    handler: { controller: PublicShowcaseController, method: 'get' },
  },
];
