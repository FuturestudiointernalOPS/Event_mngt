import { PERMISSIONS } from '@event-platform/shared';
import type { RouteDefinition } from '../../common/routes/route-definition';
import { InvitationsController } from './invitations.controller';
import { MembershipsController } from './memberships.controller';

export const routes: RouteDefinition[] = [
  {
    method: 'GET',
    path: '/workspaces/:slug/members',
    permission: PERMISSIONS.memberRead,
    handler: { controller: MembershipsController, method: 'list' },
  },
  {
    method: 'GET',
    path: '/workspaces/:slug/roles',
    permission: PERMISSIONS.memberRead,
    handler: { controller: MembershipsController, method: 'roles' },
  },
  {
    method: 'POST',
    path: '/workspaces/:slug/invitations',
    permission: PERMISSIONS.memberManage,
    handler: { controller: MembershipsController, method: 'invite' },
  },
  {
    method: 'PATCH',
    path: '/workspaces/:slug/members/:memberId',
    permission: PERMISSIONS.memberManage,
    handler: { controller: MembershipsController, method: 'updateRole' },
  },
  {
    method: 'DELETE',
    path: '/workspaces/:slug/members/:memberId',
    permission: PERMISSIONS.memberManage,
    handler: { controller: MembershipsController, method: 'remove' },
  },
  {
    method: 'POST',
    path: '/auth/invitations/:token/accept',
    permission: null,
    handler: { controller: InvitationsController, method: 'accept' },
  },
];
