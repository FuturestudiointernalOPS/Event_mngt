import { describe, expect, it } from 'vitest';
import { erasedPerson, isErasedEmail } from './registrations.erasure';

describe('erasure', () => {
  it('replaces every identifying field', () => {
    const erased = erasedPerson('person-1');

    expect(erased.firstName).toBe('[erased]');
    expect(erased.lastName).toBe('[erased]');
    expect(erased.phone).toBeNull();
    expect(erased.organizationName).toBeNull();
    expect(erased.jobTitle).toBeNull();
    expect(erased.country).toBeNull();
  });

  it('produces a unique, undeliverable address per person', () => {
    const first = erasedPerson('person-1').email;
    const second = erasedPerson('person-2').email;

    expect(first).toBe('erased-person-1@erased.invalid');
    expect(first).not.toBe(second);
    expect(isErasedEmail(first)).toBe(true);
  });

  it('recognises an already erased address', () => {
    expect(isErasedEmail('someone@example.test')).toBe(false);
  });
});
