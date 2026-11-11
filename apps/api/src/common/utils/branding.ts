import type { Branding, Locale } from '@event-platform/shared';
import type { WorkspaceBranding } from '../../database/prisma-client';

/**
 * Branding row → contract. Lives in common/ because both the workspaces module and
 * the public event surface need it, and a module must not import another module's
 * internals (R10).
 */
export function toBranding(row: WorkspaceBranding): Branding {
  return {
    primaryColor: row.primaryColor,
    secondaryColor: row.secondaryColor,
    accentColor: row.accentColor,
    backgroundColor: row.backgroundColor,
    surfaceColor: row.surfaceColor,
    textColor: row.textColor,
    colorMode: row.colorMode === 'dark' ? 'dark' : 'light',
    logoUrl: row.logoUrl,
    logoDarkUrl: row.logoDarkUrl,
    faviconUrl: row.faviconUrl,
    borderRadius: row.borderRadius,
  };
}

/** Anything other than an explicit English default falls back to French. */
export function toLocale(value: string | null | undefined): Locale {
  return value === 'en' ? 'en' : 'fr';
}
