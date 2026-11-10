import {
  API_PATHS,
  type CapabilityCatalogueResponse,
  type MemberCapabilitiesView,
  type MemberSummary,
  type OrganizationCapabilitiesView,
  type PlatformOrganizationSummary,
  type RoleSummary,
} from '@event-platform/shared';
import { apiRequest } from '@/services/api-client';

/**
 * Capability management calls. Views come back fully annotated, so a screen never has
 * to reconstruct why a member can or cannot do something.
 */
export const capabilitiesApi = {
  members(slug: string): Promise<MemberSummary[]> {
    return apiRequest<MemberSummary[]>(API_PATHS.workspaces.members(slug));
  },

  roles(slug: string): Promise<RoleSummary[]> {
    return apiRequest<RoleSummary[]>(API_PATHS.workspaces.roles(slug));
  },

  self(slug: string): Promise<MemberCapabilitiesView> {
    return apiRequest<MemberCapabilitiesView>(API_PATHS.workspaces.selfCapabilities(slug));
  },

  organization(slug: string): Promise<OrganizationCapabilitiesView> {
    return apiRequest<OrganizationCapabilitiesView>(API_PATHS.workspaces.capabilities(slug));
  },

  member(slug: string, memberId: string): Promise<MemberCapabilitiesView> {
    return apiRequest<MemberCapabilitiesView>(
      API_PATHS.workspaces.memberCapabilities(slug, memberId),
    );
  },

  grantMember(slug: string, memberId: string, capabilityKey: string) {
    return apiRequest<MemberCapabilitiesView>(
      API_PATHS.workspaces.memberCapability(slug, memberId, capabilityKey),
      { method: 'PUT' },
    );
  },

  revokeMember(slug: string, memberId: string, capabilityKey: string) {
    return apiRequest<MemberCapabilitiesView>(
      API_PATHS.workspaces.memberCapability(slug, memberId, capabilityKey),
      { method: 'DELETE' },
    );
  },

  catalogue(): Promise<CapabilityCatalogueResponse> {
    return apiRequest<CapabilityCatalogueResponse>(API_PATHS.platform.capabilities);
  },

  organizations(): Promise<PlatformOrganizationSummary[]> {
    return apiRequest<PlatformOrganizationSummary[]>(API_PATHS.platform.organizations);
  },

  organizationEntitlements(organizationId: string): Promise<OrganizationCapabilitiesView> {
    return apiRequest<OrganizationCapabilitiesView>(
      API_PATHS.platform.organizationCapabilities(organizationId),
    );
  },

  grantOrganization(organizationId: string, capabilityKey: string) {
    return apiRequest<OrganizationCapabilitiesView>(
      API_PATHS.platform.organizationCapability(organizationId, capabilityKey),
      { method: 'PUT' },
    );
  },

  revokeOrganization(organizationId: string, capabilityKey: string) {
    return apiRequest<OrganizationCapabilitiesView>(
      API_PATHS.platform.organizationCapability(organizationId, capabilityKey),
      { method: 'DELETE' },
    );
  },
};
