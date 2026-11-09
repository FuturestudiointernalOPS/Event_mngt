import { describe, expect, it } from 'vitest';
import type { WorkspaceBranding } from '../../database/prisma-client';
import { toBranding, toLocale } from './branding';

function row(overrides: Partial<WorkspaceBranding> = {}): WorkspaceBranding {
  return {
    primaryColor: '#123456',
    secondaryColor: '#234567',
    accentColor: '#345678',
    backgroundColor: '#FFFFFF',
    surfaceColor: '#F5F5F5',
    textColor: '#111111',
    colorMode: 'light',
    logoUrl: 'https://example.test/logo.png',
    logoDarkUrl: null,
    faviconUrl: null,
    borderRadius: 8,
    ...overrides,
  } as WorkspaceBranding;
}

describe('toBranding', () => {
  it('maps every stored token onto the contract', () => {
    const branding = toBranding(row());

    expect(branding).toEqual({
      primaryColor: '#123456',
      secondaryColor: '#234567',
      accentColor: '#345678',
      backgroundColor: '#FFFFFF',
      surfaceColor: '#F5F5F5',
      textColor: '#111111',
      colorMode: 'light',
      logoUrl: 'https://example.test/logo.png',
      logoDarkUrl: null,
      faviconUrl: null,
      borderRadius: 8,
    });
  });

  it('falls back to light for an unrecognised colour mode', () => {
    expect(toBranding(row({ colorMode: 'sepia' })).colorMode).toBe('light');
  });

  it('keeps dark mode when it is stored', () => {
    expect(toBranding(row({ colorMode: 'dark' })).colorMode).toBe('dark');
  });
});

describe('toLocale', () => {
  it('accepts English', () => {
    expect(toLocale('en')).toBe('en');
  });

  it('defaults everything else to French', () => {
    expect(toLocale('fr')).toBe('fr');
    expect(toLocale(null)).toBe('fr');
    expect(toLocale(undefined)).toBe('fr');
    expect(toLocale('de')).toBe('fr');
  });
});
