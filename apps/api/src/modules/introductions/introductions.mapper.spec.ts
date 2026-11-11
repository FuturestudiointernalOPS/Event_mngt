import { describe, expect, it } from 'vitest';
import type {
  IntroductionDetailRow,
  IntroductionRequestRow,
} from './introductions.repository';
import {
  toIntroductionRequest,
  toIntroductionRequestDetail,
} from './introductions.mapper';

const PROFILE = {
  id: 'profile-a',
  registration: { person: { firstName: 'Amina', lastName: 'Dossou' } },
};

function row(overrides: Partial<IntroductionRequestRow> = {}): IntroductionRequestRow {
  return {
    id: 'intro-1',
    organizationId: 'org-1',
    eventId: 'event-1',
    requestingProfileId: 'profile-a',
    reason: 'Looking for a manufacturing partner',
    offeredHelp: null,
    status: 'REQUESTED',
    assignedToUserId: null,
    decidedAt: null,
    decidedByUserId: null,
    outcome: null,
    outcomeNotes: null,
    createdAt: new Date('2026-04-01T08:00:00.000Z'),
    updatedAt: new Date('2026-04-01T08:00:00.000Z'),
    requestingProfile: PROFILE,
    ...overrides,
  };
}

describe('introduction mapping', () => {
  it('maps a request and its requesting profile', () => {
    const request = toIntroductionRequest(row());

    expect(request.requestingProfile).toEqual({
      id: 'profile-a',
      displayName: 'Amina Dossou',
    });
    expect(request.status).toBe('REQUESTED');
    expect(request.createdAt).toBe('2026-04-01T08:00:00.000Z');
    expect(request.decidedAt).toBeNull();
  });

  it('maps the detail with its history in the order it was read', () => {
    const detail: IntroductionDetailRow = {
      ...row({ status: 'INTRODUCED', outcome: 'CONNECTED' }),
      statusHistory: [
        {
          id: 'history-1',
          organizationId: 'org-1',
          eventId: 'event-1',
          requestId: 'intro-1',
          fromStatus: null,
          toStatus: 'REQUESTED',
          actorUserId: 'user-1',
          note: null,
          createdAt: new Date('2026-04-01T08:00:00.000Z'),
        },
        {
          id: 'history-2',
          organizationId: 'org-1',
          eventId: 'event-1',
          requestId: 'intro-1',
          fromStatus: 'REQUESTED',
          toStatus: 'INTRODUCED',
          actorUserId: 'user-1',
          note: 'Connected by email',
          createdAt: new Date('2026-04-02T09:00:00.000Z'),
        },
      ],
    };

    const mapped = toIntroductionRequestDetail(detail);

    expect(mapped.history).toEqual([
      {
        fromStatus: null,
        toStatus: 'REQUESTED',
        actorUserId: 'user-1',
        note: null,
        createdAt: '2026-04-01T08:00:00.000Z',
      },
      {
        fromStatus: 'REQUESTED',
        toStatus: 'INTRODUCED',
        actorUserId: 'user-1',
        note: 'Connected by email',
        createdAt: '2026-04-02T09:00:00.000Z',
      },
    ]);
  });
});
