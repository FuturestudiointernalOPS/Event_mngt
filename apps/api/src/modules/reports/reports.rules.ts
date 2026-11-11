import type {
  EditionComparisonEntry,
  EventReportTimelinePoint,
  OrganizationReportEvent,
  RegistrationBreakdown,
} from '@event-platform/shared';
import type { EventStatus, RegistrationStatus } from '../../database/prisma-client';
import { toBreakdown, type StatusCountRow } from './reports.shapes';

/**
 * Timeline and portfolio rules (WP-18). These combine grouped rows across events; the
 * single-event count shaping lives in `reports.shapes.ts`.
 */

export interface EventRow {
  id: string;
  name: string;
  slug: string;
  status: EventStatus;
  startsAt: Date;
  parentEventId: string | null;
}

export interface EventStatusCountRow {
  eventId: string;
  status: RegistrationStatus;
  count: number;
}

export interface TimelineRow {
  day: Date;
  count: number;
}

const PUBLISHED_STATUSES = new Set<EventStatus>([
  'PUBLISHED',
  'REGISTRATION_OPEN',
  'REGISTRATION_CLOSED',
  'COMPLETED',
]);

function utcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Daily submission counts for the last `days` calendar days in UTC, gaps filled with
 * zero. A chart that silently omits empty days misleads the reader.
 */
export function buildTimeline(
  rows: TimelineRow[],
  days: number,
  now: Date = new Date(),
): EventReportTimelinePoint[] {
  const byDay = new Map<string, number>();

  for (const row of rows) {
    const key = utcDayKey(row.day);
    byDay.set(key, (byDay.get(key) ?? 0) + row.count);
  }

  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const timeline: EventReportTimelinePoint[] = [];

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const key = utcDayKey(new Date(today - offset * 86_400_000));
    timeline.push({ date: key, count: byDay.get(key) ?? 0 });
  }

  return timeline;
}

/** Start of the timeline window, used by the repository predicate. */
export function timelineSince(days: number, now: Date = new Date()): Date {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  return new Date(today - (days - 1) * 86_400_000);
}

export function groupCountsByEvent(rows: EventStatusCountRow[]): Map<string, StatusCountRow[]> {
  const grouped = new Map<string, StatusCountRow[]>();

  for (const row of rows) {
    const existing = grouped.get(row.eventId) ?? [];
    existing.push({ status: row.status, count: row.count });
    grouped.set(row.eventId, existing);
  }

  return grouped;
}

function countsForEvent(
  counts: Map<string, StatusCountRow[]>,
  eventId: string,
): RegistrationBreakdown {
  return toBreakdown(counts.get(eventId) ?? []);
}

export function buildOrganizationEvents(
  events: EventRow[],
  counts: EventStatusCountRow[],
): OrganizationReportEvent[] {
  const grouped = groupCountsByEvent(counts);

  return events.map((event) => ({
    id: event.id,
    name: event.name,
    slug: event.slug,
    status: event.status,
    startsAt: event.startsAt.toISOString(),
    parentEventId: event.parentEventId,
    registrations: countsForEvent(grouped, event.id),
  }));
}

export function buildOrganizationTotals(
  events: EventRow[],
  counts: EventStatusCountRow[],
): {
  events: number;
  publishedEvents: number;
  registrations: RegistrationBreakdown;
} {
  const grouped = groupCountsByEvent(counts);
  const totalRows: StatusCountRow[] = [];

  for (const rows of grouped.values()) {
    totalRows.push(...rows);
  }

  return {
    events: events.length,
    publishedEvents: events.filter((event) => PUBLISHED_STATUSES.has(event.status)).length,
    registrations: toBreakdown(totalRows),
  };
}

export function buildEditionEntries(
  events: EventRow[],
  counts: EventStatusCountRow[],
): EditionComparisonEntry[] {
  const grouped = groupCountsByEvent(counts);

  return events.map((event) => ({
    id: event.id,
    name: event.name,
    slug: event.slug,
    startsAt: event.startsAt.toISOString(),
    status: event.status,
    registrations: countsForEvent(grouped, event.id),
  }));
}
