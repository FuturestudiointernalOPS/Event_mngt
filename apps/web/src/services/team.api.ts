import type { AcceptInvitationResponse, InvitationSummary, MemberSummary, RoleSummary } from '@event-platform/shared';
import { apiRequest } from './api-client';

const ws = (slug: string): string => `/api/v1/workspaces/${slug}`;

/**
 * Team management.
 *
 * The capability model replaced the old team routes: members and roles are read from the
 * workspace, invitations are created through the workspace and accepted through the auth
 * surface, and suspending a member is no longer a supported transition.
 */
export const teamApi = {
  /**
   * Creates a new organisation. No server route exists for this on the current backend;
   * the call is kept so the onboarding screen keeps its shape until the route returns.
   */
  createOrganization: (payload: {
    name: string;
    slug?: string;
    timeZone?: string;
    defaultLocale?: string;
  }) =>
    apiRequest<{ id: string; slug: string; name: string }>('/api/v1/organizations', {
      method: 'POST',
      body: payload,
    }),

  members: (slug: string) => apiRequest<MemberSummary[]>(`${ws(slug)}/members`),
  roles: (slug: string) => apiRequest<RoleSummary[]>(`${ws(slug)}/roles`),
  updateMember: (slug: string, id: string, payload: { roleId?: string; status?: 'ACTIVE' | 'SUSPENDED' }) =>
    apiRequest<MemberSummary>(`${ws(slug)}/members/${id}`, { method: 'PATCH', body: payload }),
  removeMember: (slug: string, id: string) =>
    apiRequest<void>(`${ws(slug)}/members/${id}`, { method: 'DELETE' }),
  invite: (slug: string, payload: { email: string; roleId: string }) =>
    apiRequest<InvitationSummary>(`${ws(slug)}/invitations`, { method: 'POST', body: payload }),
  invitations: (slug: string) => apiRequest<InvitationSummary[]>(`${ws(slug)}/invitations`),
  revokeInvitation: (slug: string, id: string) =>
    apiRequest<void>(`${ws(slug)}/invitations/${id}`, { method: 'DELETE' }),
  acceptInvitation: (token: string) =>
    apiRequest<AcceptInvitationResponse>(`/api/v1/auth/invitations/${token}/accept`, {
      method: 'POST',
    }),
};
