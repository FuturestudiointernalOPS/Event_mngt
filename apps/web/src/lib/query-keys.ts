/**
 * TanStack Query key factory. Keys are built in one place so invalidations cannot
 * drift from the queries they target.
 */
export const queryKeys = {
  publicEvent: (eventSlug: string) => ['public-event', eventSlug] as const,
  workspaceContext: (slug: string) => ['workspace-context', slug] as const,
  workspaceSettings: (slug: string) => ['workspace-settings', slug] as const,
  workspaceBranding: (slug: string) => ['workspace-branding', slug] as const,
  events: (slug: string, filters?: Record<string, unknown>) =>
    ['events', slug, filters ?? {}] as const,
  event: (slug: string, eventId: string) => ['event', slug, eventId] as const,
  session: () => ['session'] as const,
  sessions: () => ['sessions'] as const,
};
