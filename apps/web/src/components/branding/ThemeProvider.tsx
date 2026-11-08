import { DEFAULT_BRANDING, type Branding } from '@event-platform/shared';
import { createContext, useContext, useEffect, type ReactNode } from 'react';

export interface BrandingContextValue {
  organization: { id?: string; slug: string; name: string };
  branding: Branding;
}

const BrandingContext = createContext<BrandingContextValue | null>(null);

/**
 * Applies the resolved workspace branding as CSS custom properties on :root.
 *
 * Applied on the document root rather than a wrapper element so dialogs, portals and
 * toasts inherit the tenant theme too. Never renders another tenant's colours: callers
 * pass null while context is loading, which resets to the neutral defaults.
 */
export function ThemeProvider({
  value,
  children,
}: {
  value: BrandingContextValue | null;
  children: ReactNode;
}): JSX.Element {
  useEffect(() => {
    applyBranding(value?.branding ?? null);
    if (value) {
      document.title = value.organization.name;
    }
  }, [value]);

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding(): BrandingContextValue | null {
  return useContext(BrandingContext);
}

export function applyBranding(branding: Branding | null): void {
  const resolved = branding ?? DEFAULT_BRANDING;
  const root = document.documentElement;

  root.style.setProperty('--brand-primary', resolved.primaryColor);
  root.style.setProperty('--brand-secondary', resolved.secondaryColor);
  root.style.setProperty('--brand-accent', resolved.accentColor);
  root.style.setProperty('--brand-background', resolved.backgroundColor);
  root.style.setProperty('--brand-surface', resolved.surfaceColor);
  root.style.setProperty('--brand-text', resolved.textColor);

  if (resolved.borderRadius) {
    root.style.setProperty('--brand-radius', resolved.borderRadius);
  }

  const favicon = document.getElementById('brand-favicon');
  if (favicon instanceof HTMLLinkElement && resolved.faviconUrl) {
    favicon.href = resolved.faviconUrl;
  }
}
