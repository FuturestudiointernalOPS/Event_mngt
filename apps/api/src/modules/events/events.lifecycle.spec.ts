import { describe, expect, it } from 'vitest';
import { AppException } from '../../common/app-exception';
import { EventStatus, EventVisibility } from '../../database/prisma-client';
import { assertPublishable, shouldActivatePublishingModule } from './events.lifecycle';

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
