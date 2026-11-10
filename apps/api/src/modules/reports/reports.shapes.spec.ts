import { describe, expect, it } from 'vitest';
import {
  approvalRate,
  sumStatusCounts,
  toBadgeCounts,
  toCategoryReport,
  toModerationCounts,
  toSourceCounts,
  toStatusCounts,
} from './reports.shapes';

describe('report count shaping', () => {
  it('fills every status and adds duplicate groups', () => {
    const counts = toStatusCounts([
      { status: 'PENDING', count: 2 },
      { status: 'PENDING', count: 3 },
      { status: 'APPROVED', count: 4 },
    ]);

    expect(counts).toEqual({
      PENDING: 5,
      APPROVED: 4,
      REJECTED: 0,
      WAITLISTED: 0,
      CANCELLED: 0,
    });
    expect(sumStatusCounts(counts)).toBe(9);
  });

  it('reports no approval rate until something is decided', () => {
    expect(
      approvalRate({
        PENDING: 5,
        APPROVED: 0,
        REJECTED: 0,
        WAITLISTED: 3,
        CANCELLED: 0,
      }),
    ).toBeNull();

    expect(
      approvalRate({
        PENDING: 0,
        APPROVED: 3,
        REJECTED: 1,
        WAITLISTED: 0,
        CANCELLED: 0,
      }),
    ).toBe(0.75);
  });

  it('maps category counts and keeps categories with no registrations', () => {
    const rows = toCategoryReport(
      [
        { categoryId: 'startup', count: 7 },
        { categoryId: null, count: 2 },
      ],
      [
        { id: 'startup', key: 'startup', name: 'Startup', capacity: 50 },
        { id: 'student', key: 'student', name: 'Student', capacity: null },
      ],
    );

    expect(rows).toEqual([
      { key: 'startup', name: 'Startup', capacity: 50, count: 7 },
      { key: 'student', name: 'Student', capacity: null, count: 0 },
    ]);
  });

  it('counts sources and badges without inventing rows', () => {
    expect(
      toSourceCounts([
        { source: 'PUBLIC', count: 4 },
        { source: 'STAFF', count: 1 },
      ]),
    ).toEqual({ PUBLIC: 4, STAFF: 1, IMPORT: 0 });

    expect(
      toBadgeCounts([
        { status: 'ISSUED', count: 3 },
        { status: 'REVOKED', count: 1 },
      ]),
    ).toEqual({ issued: 3, revoked: 1 });
  });

  it('counts moderation states with zeros for the absent ones', () => {
    expect(
      toModerationCounts([{ moderationStatus: 'APPROVED', count: 2 }]),
    ).toEqual({ DRAFT: 0, PENDING: 0, APPROVED: 2, REJECTED: 0 });
  });
});
