import { CAPABILITY_KEYS } from '@event-platform/shared';
import type { RouteDefinition } from '../../common/routes/route-definition';
import { InvitationsController } from './invitations.controller';
import { MembershipsController } from './memberships.controller';

export const routes: RouteDefinition[] = [
  {
    method: 'GET',
    path: '/workspaces/:slug/members',
    capability: CAPABILITY_KEYS.organizationViewMembers,
    handler: { controller: MembershipsController, method: 'list' },
  },
  {
    method: 'GET',
    path: '/workspaces/:slug/roles',
    capability: CAPABILITY_KEYS.organizationViewMembers,
    handler: { controller: MembershipsController, method: 'roles' },
  },
  {
    method: 'GET',
    path: '/workspaces/:slug/invitations',
    capability: CAPABILITY_KEYS.organizationViewMembers,
    handler: { controller: MembershipsController, method: 'listInvitations' },
  },
  {
    method: 'POST',
    path: '/workspaces/:slug/invitations',
    capability: CAPABILITY_KEYS.organizationInviteMembers,
    handler: { controller: MembershipsController, method: 'invite' },
  },
  {
    method: 'DELETE',
    path: '/workspaces/:slug/invitations/:invitationId',
    capability: CAPABILITY_KEYS.organizationInviteMembers,
    handler: { controller: MembershipsController, method: 'revokeInvitation' },
  },
  {
    method: 'PATCH',
    path: '/workspaces/:slug/members/:memberId',
    capability: CAPABILITY_KEYS.organizationManagePermissions,
    handler: { controller: MembershipsController, method: 'updateMember' },
  },
  {
    method: 'DELETE',
    path: '/workspaces/:slug/members/:memberId',
    capability: CAPABILITY_KEYS.organizationRemoveMembers,
    handler: { controller: MembershipsController, method: 'remove' },
  },
  {
    method: 'POST',
    path: '/auth/invitations/:token/accept',
    capability: null,
    handler: { controller: InvitationsController, method: 'accept' },
  },
];
