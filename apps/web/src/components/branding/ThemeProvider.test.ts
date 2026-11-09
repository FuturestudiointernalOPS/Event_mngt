import { DEFAULT_BRANDING, type Branding } from '@event-platform/shared';
import { describe, expect, it } from 'vitest';
import { applyBranding } from './ThemeProvider';

/**
 * Smoke test for the test environment itself: `applyBranding` touches the DOM, so
 * this fails loudly if the configured environment is wrong or the setup file is
 * missing — instead of the suite passing vacuously.
 */
const customBranding: Branding = {
  ...DEFAULT_BRANDING,
  primaryColor: '#123456',
  textColor: '#0F0F0F',
  borderRadius: '1rem',
};

describe('applyBranding', () => {
  it('writes brand tokens onto the document root', () => {
    applyBranding(customBranding);

    const root = document.documentElement.style;
    expect(root.getPropertyValue('--brand-primary').toLowerCase()).toBe('#123456');
    expect(root.getPropertyValue('--brand-text').toLowerCase()).toBe('#0f0f0f');
    expect(root.getPropertyValue('--brand-radius')).toBe('1rem');
  });

  it('falls back to the neutral palette when no workspace branding is resolved', () => {
    applyBranding(null);

    const root = document.documentElement.style;
    expect(root.getPropertyValue('--brand-primary').toLowerCase()).toBe(
      DEFAULT_BRANDING.primaryColor.toLowerCase(),
    );
  });
});
