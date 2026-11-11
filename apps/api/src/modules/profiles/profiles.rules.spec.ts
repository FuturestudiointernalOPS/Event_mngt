import { describe, expect, it } from 'vitest';
import { ModerationStatus, ProfileVisibility } from '../../database/prisma-client';
import {
  assertModeratable,
  defaultVisibility,
  isPubliclyVisible,
  nextModerationStatus,
} from './profiles.rules';

describe('moderation status transitions', () => {
  it('starts a new listing as a draft unless it is submitted', () => {
    expect(nextModerationStatus(null, false)).toBe(ModerationStatus.DRAFT);
    expect(nextModerationStatus(null, true)).toBe(ModerationStatus.PENDING);
  });

  it('invalidates an approval when the content is edited', () => {
    expect(nextModerationStatus(ModerationStatus.APPROVED, false)).toBe(
      ModerationStatus.DRAFT,
    );
  });

  it('keeps a draft or pending row in the queue', () => {
    expect(nextModerationStatus(ModerationStatus.DRAFT, false)).toBe(
      ModerationStatus.DRAFT,
    );
    expect(nextModerationStatus(ModerationStatus.PENDING, false)).toBe(
      ModerationStatus.PENDING,
    );
  });

  it('returns a rejected listing to draft on edit', () => {
    expect(nextModerationStatus(ModerationStatus.REJECTED, false)).toBe(
      ModerationStatus.DRAFT,
    );
  });
});

describe('moderation decisions', () => {
  it('allows a submitted listing to be approved or rejected', () => {
    expect(() =>
      assertModeratable(ModerationStatus.PENDING, 'APPROVED'),
    ).not.toThrow();
    expect(() =>
      assertModeratable(ModerationStatus.PENDING, 'REJECTED'),
    ).not.toThrow();
  });

  it('reports a repeated decision as a conflict', () => {
    expect(() =>
      assertModeratable(ModerationStatus.APPROVED, 'APPROVED'),
    ).toThrowError(/already approved/);
  });

  it('refuses to moderate a draft', () => {
    expect(() =>
      assertModeratable(ModerationStatus.DRAFT, 'APPROVED'),
    ).toThrowError(/Submit the listing/);
  });
});

describe('public visibility', () => {
  it('requires both approval and the public choice', () => {
    expect(
      isPubliclyVisible(ModerationStatus.APPROVED, ProfileVisibility.PUBLIC),
    ).toBe(true);
    expect(
      isPubliclyVisible(ModerationStatus.APPROVED, ProfileVisibility.PRIVATE),
    ).toBe(false);
    expect(
      isPubliclyVisible(ModerationStatus.PENDING, ProfileVisibility.PUBLIC),
    ).toBe(false);
  });

  it('uses the showcase module default', () => {
    expect(defaultVisibility(true)).toBe(ProfileVisibility.PUBLIC);
    expect(defaultVisibility(false)).toBe(ProfileVisibility.PRIVATE);
    expect(defaultVisibility(undefined)).toBe(ProfileVisibility.PRIVATE);
  });
});
