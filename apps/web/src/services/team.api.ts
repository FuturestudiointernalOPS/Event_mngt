import type {
  CreateOrganizationRequest,
  Invitation,
  InviteMemberRequest,
  RoleSummary,
  TeamMember,
  UpdateMemberRequest,
} from '@event-platform/shared';
import { apiRequest } from './api-client';

const base = (slug: string): string => `/api/v1/workspaces/${slug}/team`;

export const teamApi = {
  createOrganization(payload: CreateOrganizationRequest) {
    return apiRequest<{ id: string; slug: string; name: string }>('/api/v1/organizations', {
      method: 'POST',
      body: payload,
    });
  },
  members: (slug: string) => apiRequest<TeamMember[]>(`${base(slug)}/members`),
  roles: (slug: string) => apiRequest<RoleSummary[]>(`${base(slug)}/roles`),
  updateMember: (slug: string, id: string, payload: UpdateMemberRequest) =>
    apiRequest<TeamMember>(`${base(slug)}/members/${id}`, { method: 'PATCH', body: payload }),
  removeMember: (slug: string, id: string) =>
    apiRequest<void>(`${base(slug)}/members/${id}`, { method: 'DELETE' }),
  invitations: (slug: string) => apiRequest<Invitation[]>(`${base(slug)}/invitations`),
  invite: (slug: string, payload: InviteMemberRequest) =>
    apiRequest<Invitation>(`${base(slug)}/invitations`, { method: 'POST', body: payload }),
  revokeInvitation: (slug: string, id: string) =>
    apiRequest<void>(`${base(slug)}/invitations/${id}`, { method: 'DELETE' }),
  acceptInvitation: (payload: { workspaceSlug: string; token: string }) =>
    apiRequest<{ slug: string }>('/api/v1/invitations/accept', { method: 'POST', body: payload }),
};
