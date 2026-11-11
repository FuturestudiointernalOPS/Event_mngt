import { describe, expect, it } from 'vitest';
import {
  buildEditionEntries,
  buildOrganizationEvents,
  buildOrganizationTotals,
  buildTimeline,
} from './reports.rules';

const NOW = new Date('2026-11-10T15:30:00.000Z');

describe('report portfolio rules', () => {
  it('builds a gap-free 30-day timeline in UTC', () => {
    const timeline = buildTimeline(
      [
        { day: new Date('2026-11-09T00:00:00.000Z'), count: 2 },
        { day: new Date('2026-11-10T00:00:00.000Z'), count: 5 },
      ],
      30,
      NOW,
    );

    expect(timeline).toHaveLength(30);
    expect(timeline[0]?.date).toBe('2026-10-12');
    expect(timeline[28]).toEqual({ date: '2026-11-09', count: 2 });
    expect(timeline[29]).toEqual({ date: '2026-11-10', count: 5 });
  });

  it('builds organisation rows and totals from grouped counts', () => {
    const events = [
      {
        id: 'a',
        name: 'Event A',
        slug: 'event-a',
        status: 'PUBLISHED' as const,
        startsAt: new Date('2026-01-01T00:00:00.000Z'),
        parentEventId: null,
      },
      {
        id: 'b',
        name: 'Event B',
        slug: 'event-b',
        status: 'DRAFT' as const,
        startsAt: new Date('2026-02-01T00:00:00.000Z'),
        parentEventId: 'a',
      },
    ];
    const counts = [
      { eventId: 'a', status: 'APPROVED' as const, count: 4 },
      { eventId: 'a', status: 'PENDING' as const, count: 1 },
      { eventId: 'b', status: 'REJECTED' as const, count: 2 },
    ];

    const rows = buildOrganizationEvents(events, counts);
    expect(rows[0]?.registrations).toEqual({
      total: 5,
      byStatus: {
        PENDING: 1,
        APPROVED: 4,
        REJECTED: 0,
        WAITLISTED: 0,
        CANCELLED: 0,
      },
    });
    expect(rows[1]?.parentEventId).toBe('a');

    const totals = buildOrganizationTotals(events, counts);
    expect(totals.events).toBe(2);
    expect(totals.publishedEvents).toBe(1);
    expect(totals.registrations.total).toBe(7);
  });

  it('builds edition entries in the order the repository returns', () => {
    const entries = buildEditionEntries(
      [
        {
          id: '2025',
          name: '2025',
          slug: 'village-2025',
          status: 'COMPLETED',
          startsAt: new Date('2025-11-01T00:00:00.000Z'),
          parentEventId: 'root',
        },
      ],
      [{ eventId: '2025', status: 'APPROVED', count: 8 }],
    );

    expect(entries[0]?.registrations.total).toBe(8);
    expect(entries[0]?.startsAt).toBe('2025-11-01T00:00:00.000Z');
  });
});
