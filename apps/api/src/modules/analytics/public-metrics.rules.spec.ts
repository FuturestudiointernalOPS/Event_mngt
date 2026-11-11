import { describe, expect, it } from 'vitest';
import {
  PUBLIC_METRICS_MINIMUM,
  PUBLIC_METRICS_ROUNDING,
} from '@event-platform/shared';
import { anonymiseCount, buildPublicMetrics } from './public-metrics.rules';

const NOW = new Date('2026-11-10T10:00:00.000Z');

describe('public metric anonymisation', () => {
  it('withholds a small count instead of publishing it', () => {
    expect(anonymiseCount(0)).toBeNull();
    expect(anonymiseCount(4)).toBeNull();
    expect(anonymiseCount(5)).toBe(5);
  });

  it('rounds every published count down', () => {
    expect(anonymiseCount(19)).toBe(15);
    expect(anonymiseCount(20)).toBe(20);
    expect(anonymiseCount(101)).toBe(100);
  });

  it('uses the documented disclosure constants', () => {
    const metrics = buildPublicMetrics({
      event: { slug: 'village-2026', name: 'Innovation Village 2026' },
      registrations: 42,
      categories: [
        { id: 'startup', key: 'startup', name: 'Startup', capacity: 50 },
        { id: 'student', key: 'student', name: 'Student', capacity: null },
        { id: 'empty', key: 'empty', name: 'Empty', capacity: null },
      ],
      categoryCounts: [
        { categoryId: 'startup', count: 23 },
        { categoryId: 'student', count: 3 },
        { categoryId: null, count: 16 },
      ],
      participants: { total: 40, withOrganization: 21, countries: 6 },
      publicProfiles: 12,
      publicInnovations: 2,
      now: NOW,
    });

    expect(metrics.disclosure).toEqual({
      minimumCount: PUBLIC_METRICS_MINIMUM,
      rounding: PUBLIC_METRICS_ROUNDING,
    });
    expect(metrics.registrations.total).toBe(40);
    expect(metrics.participants).toEqual({
      total: 40,
      organizations: 20,
      countries: 5,
    });
    expect(metrics.categories).toEqual([
      { key: 'startup', name: 'Startup', count: 20 },
      { key: 'student', name: 'Student', count: null },
      { key: 'empty', name: 'Empty', count: null },
    ]);
    expect(metrics.showcase).toEqual({ profiles: 10, innovations: null });
    expect(metrics.asOf).toBe(NOW.toISOString());
    expect(metrics.event.slug).toBe('village-2026');
  });

  it('keeps the exact figure out of the response', () => {
    const metrics = buildPublicMetrics({
      event: { slug: 'e', name: 'E' },
      registrations: 101,
      categories: [],
      categoryCounts: [],
      participants: { total: 101, withOrganization: 99, countries: 7 },
      publicProfiles: 0,
      publicInnovations: 0,
      now: NOW,
    });

    expect(JSON.stringify(metrics)).not.toContain('101');
    expect(JSON.stringify(metrics)).not.toContain('99');
  });
});
