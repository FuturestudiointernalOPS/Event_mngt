import {
  API_PATHS,
  type Branding,
  type BrandingContrastWarning,
  type UpdateBrandingRequest,
  type UpdateWorkspaceSettingsRequest,
  type WorkspaceContext,
} from '@event-platform/shared';
import { apiRequest } from './api-client';

export interface WorkspaceSettingsView {
  organization: { id: string; slug: string; name: string };
  settings: {
    defaultLocale: 'fr' | 'en';
    timeZone: string;
    description: string | null;
    websiteUrl: string | null;
    contactEmail: string | null;
  };
}

export interface BrandingView {
  branding: Branding;
  contrastWarnings: BrandingContrastWarning[];
}

export const workspacesApi = {
  context(slug: string): Promise<WorkspaceContext> {
    return apiRequest<WorkspaceContext>(API_PATHS.workspaces.context(slug));
  },

  settings(slug: string): Promise<WorkspaceSettingsView> {
    return apiRequest<WorkspaceSettingsView>(API_PATHS.workspaces.settings(slug));
  },

  updateSettings(
    slug: string,
    payload: UpdateWorkspaceSettingsRequest,
  ): Promise<WorkspaceSettingsView> {
    return apiRequest<WorkspaceSettingsView>(API_PATHS.workspaces.settings(slug), {
      method: 'PATCH',
      body: payload,
    });
  },

  branding(slug: string): Promise<BrandingView> {
    return apiRequest<BrandingView>(API_PATHS.workspaces.branding(slug));
  },

  updateBranding(slug: string, payload: UpdateBrandingRequest): Promise<BrandingView> {
    return apiRequest<BrandingView>(API_PATHS.workspaces.branding(slug), {
      method: 'PATCH',
      body: payload,
    });
  },
};
