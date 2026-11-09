import { describe, expect, it } from 'vitest';
import { AppException } from '../../common/app-exception';
import {
  assertCapacity,
  assertConsent,
  assertRegistrationOpen,
  initialStatus,
  resolveDecision,
  validateAnswers,
  type FormField,
} from './registration.rules';

function fail(fn: () => unknown): AppException {
  try {
    fn();
  } catch (error) {
    if (error instanceof AppException) {
      return error;
    }
    throw error;
  }
  throw new Error('Expected a failure');
}

const field = (over: Partial<FormField>): FormField => ({
  key: 'f',
  label: 'F',
  type: 'TEXT',
  required: false,
  options: null,
  categoryId: null,
  ...over,
});

describe('validateAnswers', () => {
  const fields = [
    field({ key: 'company', required: true }),
    field({ key: 'sector', type: 'SELECT', options: ['tech', 'health'] }),
    field({ key: 'pitch', categoryId: 'startup', type: 'TEXTAREA' }),
    field({ key: 'newsletter', type: 'CHECKBOX' }),
  ];

  it('returns trimmed, valid answers only', () => {
    expect(validateAnswers(fields, 'visitor', { company: '  Acme ', sector: 'tech' })).toEqual({
      company: 'Acme',
      sector: 'tech',
    });
  });

  it('reports every problem at once, keyed by field', () => {
    const error = fail(() => validateAnswers(fields, 'visitor', { sector: 'oil', stray: 'x' }));

    expect(error.code).toBe('invalid_answers');
    expect(error.details).toEqual({
      fields: {
        stray: 'This field is not part of the form.',
        company: 'This field is required.',
        sector: 'Choose one of the listed options.',
      },
    });
  });

  it('applies category-specific fields only to their category', () => {
    expect(fail(() => validateAnswers(fields, 'visitor', { company: 'A', pitch: 'x' })).code).toBe(
      'invalid_answers',
    );
    expect(validateAnswers(fields, 'startup', { company: 'A', pitch: 'x' })).toMatchObject({ pitch: 'x' });
  });

  it('validates e-mail and phone formats and checkbox types', () => {
    const typed = [
      field({ key: 'mail', type: 'EMAIL' }),
      field({ key: 'tel', type: 'PHONE' }),
      field({ key: 'ok', type: 'CHECKBOX' }),
    ];
    const error = fail(() => validateAnswers(typed, 'c', { mail: 'nope', tel: 'abc', ok: 'yes' }));

    expect(Object.keys((error.details as { fields: object }).fields).sort()).toEqual(['mail', 'ok', 'tel']);
  });
});

describe('assertRegistrationOpen', () => {
  const now = new Date('2026-06-10T10:00:00Z');
  const open = { status: 'PUBLISHED', registrationOpensAt: null, registrationClosesAt: null };

  it('allows published and registration-open events', () => {
    expect(() => assertRegistrationOpen(open, now)).not.toThrow();
    expect(() => assertRegistrationOpen({ ...open, status: 'REGISTRATION_OPEN' }, now)).not.toThrow();
  });

  it.each([
    ['a draft', { ...open, status: 'DRAFT' }],
    ['a closed event', { ...open, status: 'REGISTRATION_CLOSED' }],
    ['before the opening date', { ...open, registrationOpensAt: new Date('2026-07-01T00:00:00Z') }],
    ['after the closing date', { ...open, registrationClosesAt: new Date('2026-06-01T00:00:00Z') }],
  ])('refuses %s', (_l, event) => {
    expect(fail(() => assertRegistrationOpen(event, now)).code).toBe('registration_closed');
  });
});

describe('capacity, status and consent', () => {
  it('refuses a full category but not an unlimited one', () => {
    expect(fail(() => assertCapacity({ capacity: 2 }, 2)).code).toBe('category_full');
    expect(() => assertCapacity({ capacity: null }, 9999)).not.toThrow();
  });

  it('confirms automatically only when the category needs no review', () => {
    expect(initialStatus({ approvalMode: 'automatic', categoryRequiresApproval: false })).toBe('CONFIRMED');
    expect(initialStatus({ approvalMode: 'automatic', categoryRequiresApproval: true })).toBe('PENDING');
    expect(initialStatus({ approvalMode: 'manual', categoryRequiresApproval: false })).toBe('PENDING');
  });

  it('applies decisions only from allowed states', () => {
    expect(resolveDecision('CONFIRM', 'PENDING')).toBe('CONFIRMED');
    expect(resolveDecision('CANCEL', 'CONFIRMED')).toBe('CANCELLED');
    expect(fail(() => resolveDecision('REJECT', 'CONFIRMED')).code).toBe('invalid_status_transition');
    expect(fail(() => resolveDecision('CONFIRM', 'CANCELLED')).code).toBe('invalid_status_transition');
  });

  it('requires consent when the event has a statement and requires it', () => {
    expect(fail(() => assertConsent(true, 'We store your data...', false)).code).toBe('consent_required');
    expect(() => assertConsent(true, 'We store your data...', true)).not.toThrow();
    expect(() => assertConsent(false, 'We store...', false)).not.toThrow();
    expect(() => assertConsent(true, null, false)).not.toThrow();
  });
});
