import { DEFAULT_BRANDING } from '@event-platform/shared';
import { describe, expect, it } from 'vitest';
import { applyBrandOverrides } from './events.projection';

describe('applyBrandOverrides', () => {
  it('returns the workspace branding when the event sets nothing', () => {
    expect(applyBrandOverrides(DEFAULT_BRANDING, null)).toEqual(DEFAULT_BRANDING);
    expect(applyBrandOverrides(DEFAULT_BRANDING, {})).toEqual(DEFAULT_BRANDING);
  });

  it('applies only the colours the event overrides and inherits the rest', () => {
    const merged = applyBrandOverrides(DEFAULT_BRANDING, { primaryColor: '#112233' });

    expect(merged.primaryColor).toBe('#112233');
    expect(merged.secondaryColor).toBe(DEFAULT_BRANDING.secondaryColor);
    expect(merged.logoUrl).toBe(DEFAULT_BRANDING.logoUrl);
  });

  it('never lets an event change the logo or surface colours (identity stays the organisation\'s)', () => {
    const merged = applyBrandOverrides(DEFAULT_BRANDING, { accentColor: '#ff0000' });

    expect(merged.backgroundColor).toBe(DEFAULT_BRANDING.backgroundColor);
    expect(merged.textColor).toBe(DEFAULT_BRANDING.textColor);
  });
});
