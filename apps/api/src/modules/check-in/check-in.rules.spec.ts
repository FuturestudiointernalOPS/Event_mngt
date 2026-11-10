import { describe, expect, it } from 'vitest';
import { AppException } from '../../common/app-exception';
import { EventStatus } from '../../database/prisma-client';
import {
  assertBadgeUsable,
  assertEventOperational,
  classifyRepeat,
  DEFAULT_DUPLICATE_WINDOW_MINUTES,
  duplicateWindowMinutes,
} from './check-in.rules';

function capture(fn: () => void): AppException {
  try {
    fn();
  } catch (error) {
    if (error instanceof AppException) {
      return error;
    }

    throw error;
  }

  throw new Error('Expected the rule to refuse.');
}

describe('event operational rule', () => {
  it('refuses a draft, cancelled or archived event', () => {
    for (const status of [
      EventStatus.DRAFT,
      EventStatus.CANCELLED,
      EventStatus.ARCHIVED,
    ]) {
      expect(capture(() => assertEventOperational(status)).code).toBe(
        'event_not_operational',
      );
    }
  });

  it('accepts an event that is running or over', () => {
    for (const status of [
      EventStatus.PUBLISHED,
      EventStatus.REGISTRATION_OPEN,
      EventStatus.REGISTRATION_CLOSED,
      EventStatus.COMPLETED,
    ]) {
      expect(() => assertEventOperational(status)).not.toThrow();
    }
  });
});

describe('badge usability rule', () => {
  it('accepts an issued badge', () => {
    expect(() => assertBadgeUsable('ISSUED')).not.toThrow();
  });

  it('refuses a revoked badge without calling it a missing record', () => {
    const error = capture(() => assertBadgeUsable('REVOKED'));

    expect(error.code).toBe('badge_revoked');
    expect(error.getStatus()).toBe(422);
  });
});

describe('duplicate window', () => {
  it('reads the module setting', () => {
    expect(duplicateWindowMinutes({ duplicateWindowMinutes: 12 })).toBe(12);
  });

  it('falls back to the registry default for a missing or invalid value', () => {
    expect(duplicateWindowMinutes({})).toBe(DEFAULT_DUPLICATE_WINDOW_MINUTES);
    expect(duplicateWindowMinutes({ duplicateWindowMinutes: -1 })).toBe(
      DEFAULT_DUPLICATE_WINDOW_MINUTES,
    );
    expect(duplicateWindowMinutes({ duplicateWindowMinutes: '5' })).toBe(
      DEFAULT_DUPLICATE_WINDOW_MINUTES,
    );
  });

  it('labels a repeat inside the window as an accidental double scan', () => {
    const original = new Date('2026-11-10T09:00:00.000Z');

    expect(
      classifyRepeat(original, new Date('2026-11-10T09:00:30.000Z'), 5),
    ).toBe('double_scan');
    expect(classifyRepeat(original, new Date('2026-11-10T09:05:00.000Z'), 5)).toBe(
      'double_scan',
    );
  });

  it('labels a later repeat as a re-entry', () => {
    const original = new Date('2026-11-10T09:00:00.000Z');

    expect(
      classifyRepeat(original, new Date('2026-11-10T09:05:01.000Z'), 5),
    ).toBe('re_entry');
  });

  it('treats an earlier device timestamp as the same repeat', () => {
    const original = new Date('2026-11-10T09:00:00.000Z');

    expect(
      classifyRepeat(original, new Date('2026-11-10T08:58:00.000Z'), 5),
    ).toBe('double_scan');
  });
});
