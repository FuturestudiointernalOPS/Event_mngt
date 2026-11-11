import { DEFAULT_BRANDING, type Branding } from '@event-platform/shared';
import { describe, expect, it } from 'vitest';
import {
  mergeEventBranding,
  toPublicContext,
  type PublicEventContextRow,
} from './events.projection';

const workspaceBranding = {
  id: 'b1',
  organizationId: 'o1',
  primaryColor: '#111111',
  secondaryColor: '#222222',
  accentColor: '#333333',
  backgroundColor: '#FFFFFF',
  surfaceColor: '#F5F7FA',
  textColor: '#172B4D',
  colorMode: 'light',
  logoUrl: null,
  logoDarkUrl: null,
  faviconUrl: null,
  borderRadius: '0.5rem',
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const resolvedBranding: Branding = {
  ...DEFAULT_BRANDING,
  primaryColor: '#111111',
  secondaryColor: '#222222',
  accentColor: '#333333',
};

function publicRow(overrides: Partial<PublicEventContextRow> = {}): PublicEventContextRow {
  return {
    slug: 'village-2026',
    name: 'Innovation Village 2026',
    description: null,
    format: 'IN_PERSON',
    visibility: 'PUBLIC',
    timeZone: 'Africa/Porto-Novo',
    startsAt: new Date('2026-11-10T09:00:00.000Z'),
    endsAt: new Date('2026-11-12T18:00:00.000Z'),
    venueName: null,
    venueAddress: null,
    bannerUrl: null,
    brandPrimaryColor: null,
    brandSecondaryColor: null,
    brandAccentColor: null,
    organization: {
      slug: 'acme',
      name: 'Acme',
      branding: workspaceBranding,
      settings: { defaultLocale: 'fr' },
    },
    ...overrides,
  } as PublicEventContextRow;
}

describe('mergeEventBranding', () => {
  it('keeps the workspace colours when the event overrides nothing', () => {
    const branding = mergeEventBranding(resolvedBranding, publicRow());

    expect(branding.primaryColor).toBe('#111111');
    expect(branding.secondaryColor).toBe('#222222');
    expect(branding.accentColor).toBe('#333333');
  });

  it('replaces only the colours the event sets', () => {
    const branding = mergeEventBranding(
      resolvedBranding,
      publicRow({ brandPrimaryColor: '#ABCDEF' }),
    );

    expect(branding.primaryColor).toBe('#ABCDEF');
    expect(branding.secondaryColor).toBe('#222222');
    expect(branding.accentColor).toBe('#333333');
    expect(branding.backgroundColor).toBe('#FFFFFF');
  });
});

describe('toPublicContext', () => {
  it('publishes the banner and the merged event theme', () => {
    const context = toPublicContext(
      publicRow({ bannerUrl: 'https://cdn.example/banner.png', brandAccentColor: '#123456' }),
    );

    expect(context.event.bannerUrl).toBe('https://cdn.example/banner.png');
    expect(context.branding.accentColor).toBe('#123456');
    expect(context.branding.primaryColor).toBe('#111111');
  });

  it('falls back to the neutral branding when the workspace has none', () => {
    const context = toPublicContext(
      publicRow({
        organization: { slug: 'acme', name: 'Acme', branding: null, settings: null },
      }),
    );

    expect(context.branding.primaryColor).toBe('#173F5F');
    expect(context.event.bannerUrl).toBeNull();
  });
});
