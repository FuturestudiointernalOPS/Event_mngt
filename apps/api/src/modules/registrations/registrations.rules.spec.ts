import { describe, expect, it } from 'vitest';
import { AppException } from '../../common/app-exception';
import { EventStatus, RegistrationStatus } from '../../database/prisma-client';
import {
  assertDecidable,
  assertRegistrationOpen,
  duplicatePolicy,
  initialStatus,
} from './registrations.rules';

describe('registration decisions', () => {
  it('allows a pending registration to be approved or rejected', () => {
    expect(() => assertDecidable(RegistrationStatus.PENDING, 'APPROVED')).not.toThrow();
    expect(() => assertDecidable(RegistrationStatus.PENDING, 'REJECTED')).not.toThrow();
  });

  it('allows a waitlisted registration to be approved', () => {
    expect(() => assertDecidable(RegistrationStatus.WAITLISTED, 'APPROVED')).not.toThrow();
  });

  it('reports a repeated approval as a conflict', () => {
    expect(() => assertDecidable(RegistrationStatus.APPROVED, 'APPROVED')).toThrowError(
      AppException,
    );

    try {
      assertDecidable(RegistrationStatus.APPROVED, 'APPROVED');
    } catch (error) {
      expect((error as AppException).code).toBe('conflict');
    }
  });

  it('refuses to move a terminal status', () => {
    for (const status of [RegistrationStatus.REJECTED, RegistrationStatus.CANCELLED]) {
      try {
        assertDecidable(status, 'APPROVED');
        throw new Error('expected a refusal');
      } catch (error) {
        expect((error as AppException).code).toBe('invalid_status_transition');
      }
    }
  });

  it('refuses to reject an approved registration', () => {
    try {
      assertDecidable(RegistrationStatus.APPROVED, 'REJECTED');
      throw new Error('expected a refusal');
    } catch (error) {
      expect((error as AppException).code).toBe('invalid_status_transition');
    }
  });
});

describe('registration window', () => {
  const now = new Date('2026-11-10T12:00:00.000Z');

  it('accepts a published event with no bounds', () => {
    expect(() =>
      assertRegistrationOpen(
        EventStatus.PUBLISHED,
        { opensAt: null, closesAt: null },
        now,
      ),
    ).not.toThrow();
  });

  it('refuses before the opening time', () => {
    expect(() =>
      assertRegistrationOpen(
        EventStatus.PUBLISHED,
        { opensAt: new Date('2026-11-11T00:00:00.000Z'), closesAt: null },
        now,
      ),
    ).toThrowError(AppException);
  });

  it('refuses after the closing time', () => {
    expect(() =>
      assertRegistrationOpen(
        EventStatus.PUBLISHED,
        { opensAt: null, closesAt: new Date('2026-11-09T00:00:00.000Z') },
        now,
      ),
    ).toThrowError(AppException);
  });

  it('refuses when the event lifecycle is over', () => {
    for (const status of [
      EventStatus.COMPLETED,
      EventStatus.REGISTRATION_CLOSED,
      EventStatus.CANCELLED,
    ]) {
      expect(() =>
        assertRegistrationOpen(status, { opensAt: null, closesAt: null }, now),
      ).toThrowError(AppException);
    }
  });
});

describe('module settings', () => {
  it('approves automatically only on the automatic setting', () => {
    expect(initialStatus('automatic')).toBe(RegistrationStatus.APPROVED);
    expect(initialStatus('manual')).toBe(RegistrationStatus.PENDING);
    expect(initialStatus(undefined)).toBe(RegistrationStatus.PENDING);
  });

  it('blocks duplicates only on the block setting', () => {
    expect(duplicatePolicy('block')).toBe('block');
    expect(duplicatePolicy('warn')).toBe('warn');
    expect(duplicatePolicy(undefined)).toBe('warn');
  });
});
