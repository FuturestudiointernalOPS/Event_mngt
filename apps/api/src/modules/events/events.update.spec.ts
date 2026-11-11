import { describe, expect, it } from 'vitest';
import { toEventUpdate } from './events.update';

describe('toEventUpdate', () => {
  it('sends only the fields that were provided', () => {
    expect(toEventUpdate({ name: 'Village 2027' })).toEqual({ name: 'Village 2027' });
  });

  it('never writes the status', () => {
    expect(toEventUpdate({ name: 'Village 2027' })).not.toHaveProperty('status');
  });

  it('normalises the slug the same way creation does', () => {
    expect(toEventUpdate({ slug: 'Innovation Village 2027' })).toEqual({
      slug: 'innovation-village-2027',
    });
  });

  it('clears all three colours when the overrides are removed', () => {
    expect(toEventUpdate({ brandOverrides: null })).toEqual({
      brandPrimaryColor: null,
      brandSecondaryColor: null,
      brandAccentColor: null,
    });
  });

  it('treats a colour missing from the object as inherited', () => {
    expect(toEventUpdate({ brandOverrides: { accentColor: '#123456' } })).toEqual({
      brandPrimaryColor: null,
      brandSecondaryColor: null,
      brandAccentColor: '#123456',
    });
  });

  it('leaves the colours alone when the key is absent', () => {
    expect(toEventUpdate({ name: 'Village 2027' })).not.toHaveProperty('brandPrimaryColor');
  });
});
