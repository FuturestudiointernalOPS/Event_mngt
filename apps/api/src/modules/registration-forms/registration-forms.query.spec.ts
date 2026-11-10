import { describe, expect, it } from 'vitest';
import { categoryKeyBase, nextAvailableKey, windowState } from './registration-forms.query';

describe('registration window', () => {
  const now = new Date('2026-11-10T12:00:00.000Z');

  it('is open when neither bound is set', () => {
    expect(windowState({ registrationOpensAt: null, registrationClosesAt: null }, now)).toEqual({
      opensAt: null,
      closesAt: null,
      isOpen: true,
    });
  });

  it('is closed before the opening time', () => {
    const state = windowState(
      { registrationOpensAt: new Date('2026-11-11T00:00:00.000Z'), registrationClosesAt: null },
      now,
    );

    expect(state.isOpen).toBe(false);
    expect(state.opensAt).toBe('2026-11-11T00:00:00.000Z');
  });

  it('includes the opening and closing instants', () => {
    expect(
      windowState(
        {
          registrationOpensAt: now,
          registrationClosesAt: now,
        },
        now,
      ).isOpen,
    ).toBe(true);
  });

  it('is closed after the closing time', () => {
    const state = windowState(
      { registrationOpensAt: null, registrationClosesAt: new Date('2026-11-09T00:00:00.000Z') },
      now,
    );

    expect(state.isOpen).toBe(false);
  });
});

describe('category keys', () => {
  it('derives a key from a French label', () => {
    expect(categoryKeyBase('Étudiant International')).toBe('etudiant-international');
  });

  it('falls back to a usable key for a label with no letters', () => {
    expect(categoryKeyBase('***')).toBe('category');
  });

  it('keeps the base when it is free', () => {
    expect(nextAvailableKey('startup', ['student'])).toBe('startup');
  });

  it('appends the first free suffix', () => {
    expect(nextAvailableKey('startup', ['startup'])).toBe('startup-2');
    expect(nextAvailableKey('startup', ['startup', 'startup-2'])).toBe('startup-3');
  });
});
