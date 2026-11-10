/**
 * Canonical API paths. Both the web client and the API's Swagger annotations use these so
 * a route rename cannot silently desynchronise the two.
 *
 * All paths are absolute and already include the version prefix.
 */

export const API_PREFIX = 'api';
export const API_VERSION = 'v1';
export const API_BASE_PATH = `/${API_PREFIX}/${API_VERSION}`;

export const API_PATHS = {
  health: `${API_BASE_PATH}/health`,
  healthReady: `${API_BASE_PATH}/health/ready`,

  auth: {
    register: `${API_BASE_PATH}/auth/register`,
    login: `${API_BASE_PATH}/auth/login`,
    logout: `${API_BASE_PATH}/auth/logout`,
    refresh: `${API_BASE_PATH}/auth/refresh`,
    verifyEmail: `${API_BASE_PATH}/auth/verify-email`,
    forgotPassword: `${API_BASE_PATH}/auth/forgot-password`,
    resetPassword: `${API_BASE_PATH}/auth/reset-password`,
    me: `${API_BASE_PATH}/auth/me`,
    sessions: `${API_BASE_PATH}/auth/sessions`,
    session: (sessionId: string) => `${API_BASE_PATH}/auth/sessions/${sessionId}`,
  },

  workspaces: {
    context: (slug: string) => `${API_BASE_PATH}/workspaces/${slug}/context`,
    settings: (slug: string) => `${API_BASE_PATH}/workspaces/${slug}/settings`,
    branding: (slug: string) => `${API_BASE_PATH}/workspaces/${slug}/branding`,
    brandingAsset: (slug: string, kind: string) =>
      `${API_BASE_PATH}/workspaces/${slug}/branding/assets/${kind}`,
    members: (slug: string) => `${API_BASE_PATH}/workspaces/${slug}/members`,
    roles: (slug: string) => `${API_BASE_PATH}/workspaces/${slug}/roles`,
    selfCapabilities: (slug: string) =>
      `${API_BASE_PATH}/workspaces/${slug}/me/capabilities`,
    capabilities: (slug: string) => `${API_BASE_PATH}/workspaces/${slug}/capabilities`,
    memberCapabilities: (slug: string, memberId: string) =>
      `${API_BASE_PATH}/workspaces/${slug}/members/${memberId}/capabilities`,
    memberCapability: (slug: string, memberId: string, capabilityKey: string) =>
      `${API_BASE_PATH}/workspaces/${slug}/members/${memberId}/capabilities/${capabilityKey}`,
  },

  platform: {
    capabilities: `${API_BASE_PATH}/platform/capabilities`,
    organizations: `${API_BASE_PATH}/platform/organizations`,
    organizationOverview: `${API_BASE_PATH}/platform/organizations/overview`,
    organizationDetail: (organizationId: string) =>
      `${API_BASE_PATH}/platform/organizations/${organizationId}`,
    organizationStatus: (organizationId: string) =>
      `${API_BASE_PATH}/platform/organizations/${organizationId}/status`,
    organizationCapabilities: (organizationId: string) =>
      `${API_BASE_PATH}/platform/organizations/${organizationId}/capabilities`,
    organizationCapability: (organizationId: string, capabilityKey: string) =>
      `${API_BASE_PATH}/platform/organizations/${organizationId}/capabilities/${capabilityKey}`,
  },

  onboarding: {
    organizations: `${API_BASE_PATH}/onboarding/organizations`,
  },

  events: {
    list: (slug: string) => `${API_BASE_PATH}/workspaces/${slug}/events`,
    detail: (slug: string, eventId: string) =>
      `${API_BASE_PATH}/workspaces/${slug}/events/${eventId}`,
    modules: (slug: string, eventId: string) =>
      `${API_BASE_PATH}/workspaces/${slug}/events/${eventId}/modules`,
    publish: (slug: string, eventId: string) =>
      `${API_BASE_PATH}/workspaces/${slug}/events/${eventId}/publish`,
    editions: (slug: string, eventId: string) =>
      `${API_BASE_PATH}/workspaces/${slug}/events/${eventId}/editions`,
    edition: (slug: string, eventId: string, editionId: string) =>
      `${API_BASE_PATH}/workspaces/${slug}/events/${eventId}/editions/${editionId}`,
  },

  publicEvents: {
    context: (eventSlug: string) => `${API_BASE_PATH}/public/events/${eventSlug}/context`,
    detail: (eventSlug: string) => `${API_BASE_PATH}/public/events/${eventSlug}`,
    metrics: (eventSlug: string) => `${API_BASE_PATH}/public/events/${eventSlug}/metrics`,
  },

  reports: {
    eventSummary: (slug: string, eventId: string) =>
      `${API_BASE_PATH}/workspaces/${slug}/events/${eventId}/reports/summary`,
    organizationSummary: (slug: string) =>
      `${API_BASE_PATH}/workspaces/${slug}/reports/summary`,
    editions: (slug: string, eventId: string) =>
      `${API_BASE_PATH}/workspaces/${slug}/events/${eventId}/reports/editions`,
    exports: (slug: string, eventId: string) =>
      `${API_BASE_PATH}/workspaces/${slug}/events/${eventId}/exports`,
    exportDetail: (slug: string, exportId: string) =>
      `${API_BASE_PATH}/workspaces/${slug}/exports/${exportId}`,
    exportDownload: (slug: string, exportId: string) =>
      `${API_BASE_PATH}/workspaces/${slug}/exports/${exportId}/download`,
  },

  moduleRegistry: `${API_BASE_PATH}/modules`,
} as const;

export const ACCESS_TOKEN_COOKIE = 'ep_access';
export const REFRESH_TOKEN_COOKIE = 'ep_refresh';
export const CSRF_COOKIE = 'ep_csrf';
