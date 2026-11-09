import { describe, expect, it } from 'vitest';
import { AppException } from '../../common/app-exception';
import { EventStatus, EventVisibility } from '../../database/prisma-client';
import {
  assertDateRange,
  assertEditable,
  assertSlugChangeAllowed,
  assertPublishable,
  resolveTransition,
  shouldActivatePublishingModule,
} from './events.lifecycle';

function capture(fn: () => void): AppException {
  try {
    fn();
  } catch (error) {
    if (error instanceof AppException) {
      return error;
    }
    throw error;
  }
  throw new Error('Expected the call to throw');
}

describe('assertPublishable', () => {
  it('allows a draft to be published', () => {
    expect(() => assertPublishable(EventStatus.DRAFT)).not.toThrow();
    expect(() => assertPublishable(EventStatus.REGISTRATION_OPEN)).not.toThrow();
  });

  it('refuses to publish an event that is already published', () => {
    const error = capture(() => assertPublishable(EventStatus.PUBLISHED));

    expect(error.code).toBe('conflict');
  });

  it('refuses to publish an event that is over', () => {
    expect(capture(() => assertPublishable(EventStatus.CANCELLED)).code).toBe(
      'invalid_status_transition',
    );
    expect(capture(() => assertPublishable(EventStatus.ARCHIVED)).code).toBe(
      'invalid_status_transition',
    );
  });
});

describe('shouldActivatePublishingModule', () => {
  it('activates for public and unlisted events', () => {
    expect(shouldActivatePublishingModule(EventVisibility.PUBLIC)).toBe(true);
    expect(shouldActivatePublishingModule(EventVisibility.UNLISTED)).toBe(true);
  });

  it('stays disabled for private events', () => {
    expect(shouldActivatePublishingModule(EventVisibility.PRIVATE)).toBe(false);
  });
});

describe('resolveTransition', () => {
  it('sends an unpublished event back to draft', () => {
    expect(resolveTransition('unpublish', EventStatus.PUBLISHED)).toBe(EventStatus.DRAFT);
  });

  it('only unpublishes a published event', () => {
    expect(capture(() => resolveTransition('unpublish', EventStatus.DRAFT)).code).toBe(
      'invalid_status_transition',
    );
  });

  it('completes only a live event', () => {
    expect(resolveTransition('complete', EventStatus.REGISTRATION_OPEN)).toBe(
      EventStatus.COMPLETED,
    );
    expect(capture(() => resolveTransition('complete', EventStatus.DRAFT)).code).toBe(
      'invalid_status_transition',
    );
  });

  it('cancels a draft or live event but never a finished one', () => {
    expect(resolveTransition('cancel', EventStatus.DRAFT)).toBe(EventStatus.CANCELLED);
    expect(capture(() => resolveTransition('cancel', EventStatus.COMPLETED)).code).toBe(
      'invalid_status_transition',
    );
  });

  it('archives only events that are over or still draft', () => {
    expect(resolveTransition('archive', EventStatus.COMPLETED)).toBe(EventStatus.ARCHIVED);
    expect(capture(() => resolveTransition('archive', EventStatus.PUBLISHED)).code).toBe(
      'invalid_status_transition',
    );
  });
});

describe('assertEditable', () => {
  it('allows editing draft and live events', () => {
    expect(() => assertEditable(EventStatus.DRAFT)).not.toThrow();
    expect(() => assertEditable(EventStatus.PUBLISHED)).not.toThrow();
  });

  it('refuses editing events that are over', () => {
    for (const status of [EventStatus.COMPLETED, EventStatus.CANCELLED, EventStatus.ARCHIVED]) {
      expect(capture(() => assertEditable(status)).code).toBe('event_not_editable');
    }
  });
});

describe('assertSlugChangeAllowed', () => {
  it('locks the slug once the event has left draft', () => {
    expect(capture(() => assertSlugChangeAllowed(EventStatus.PUBLISHED, true)).code).toBe(
      'slug_locked',
    );
  });

  it('allows keeping the slug, or changing it on a draft', () => {
    expect(() => assertSlugChangeAllowed(EventStatus.PUBLISHED, false)).not.toThrow();
    expect(() => assertSlugChangeAllowed(EventStatus.DRAFT, true)).not.toThrow();
  });
});

describe('assertDateRange', () => {
  it('requires the end to come after the start', () => {
    const start = new Date('2026-06-01T09:00:00Z');

    expect(() => assertDateRange(start, new Date('2026-06-01T17:00:00Z'))).not.toThrow();
    expect(capture(() => assertDateRange(start, start)).code).toBe('invalid_date_range');
  });
});
