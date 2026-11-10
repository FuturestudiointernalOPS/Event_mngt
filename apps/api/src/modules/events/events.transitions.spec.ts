import { describe, expect, it } from 'vitest';
import { EventStatus } from '../../database/prisma-client';
import { nextStatusFor } from './events.lifecycle';

describe('event lifecycle transitions', () => {
  it('opens and closes registration around a published event', () => {
    expect(nextStatusFor('open-registration', EventStatus.PUBLISHED)).toBe(
      EventStatus.REGISTRATION_OPEN,
    );
    expect(nextStatusFor('close-registration', EventStatus.REGISTRATION_OPEN)).toBe(
      EventStatus.REGISTRATION_CLOSED,
    );
  });

  it('unpublishes only a published event', () => {
    expect(nextStatusFor('unpublish', EventStatus.PUBLISHED)).toBe(EventStatus.DRAFT);
    expect(() => nextStatusFor('unpublish', EventStatus.DRAFT)).toThrow();
  });

  it('completes an event that has run its course', () => {
    expect(nextStatusFor('complete', EventStatus.REGISTRATION_CLOSED)).toBe(
      EventStatus.COMPLETED,
    );
    expect(() => nextStatusFor('complete', EventStatus.DRAFT)).toThrow();
  });

  it('refuses to close registration that never opened', () => {
    expect(() => nextStatusFor('close-registration', EventStatus.PUBLISHED)).toThrow();
    expect(() => nextStatusFor('close-registration', EventStatus.REGISTRATION_CLOSED)).toThrow();
  });

  it('never moves a finished event backwards', () => {
    expect(() => nextStatusFor('cancel', EventStatus.COMPLETED)).toThrow();
    expect(() => nextStatusFor('cancel', EventStatus.CANCELLED)).toThrow();
    expect(() => nextStatusFor('open-registration', EventStatus.ARCHIVED)).toThrow();
  });

  it('archives only a completed or cancelled event', () => {
    expect(nextStatusFor('archive', EventStatus.COMPLETED)).toBe(EventStatus.ARCHIVED);
    expect(nextStatusFor('archive', EventStatus.CANCELLED)).toBe(EventStatus.ARCHIVED);
    expect(() => nextStatusFor('archive', EventStatus.PUBLISHED)).toThrow();
  });

  it('cancels a draft or a live event', () => {
    expect(nextStatusFor('cancel', EventStatus.DRAFT)).toBe(EventStatus.CANCELLED);
    expect(nextStatusFor('cancel', EventStatus.REGISTRATION_OPEN)).toBe(
      EventStatus.CANCELLED,
    );
  });
});
