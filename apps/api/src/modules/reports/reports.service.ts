import { Injectable } from '@nestjs/common';
import type {
  EditionComparison,
  EventSummaryReport,
  OrganisationOverview,
  PublicEventStats,
} from '@event-platform/shared';
import { AppException } from '../../common/app-exception';
import { toCsv } from '../../common/utils/csv';
import { PrismaService } from '../../database/prisma.service';
import { TenantTransactionService } from '../../database/tenant-transaction.service';
import type { TenantPrismaClient } from '../../database/tenant-transaction.service';
import { publishableCount } from './anonymity';

function tally<T extends string>(items: T[]): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, item) => {
    acc[item] = (acc[item] ?? 0) + 1;
    return acc;
  }, {});
}

/** Dashboards, comparisons, exports and the anonymised public figures. */
@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantTransaction: TenantTransactionService,
  ) {}

  eventSummary(eventId: string): Promise<EventSummaryReport> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      await this.requireEvent(tx, tenant.organizationId, eventId);
      const orgId = tenant.organizationId;

      const [registrations, meetings, introductions, checkedIn] = await Promise.all([
        tx.registration.findMany({
          where: { organizationId: orgId, eventId },
          select: { status: true, createdAt: true, category: { select: { name: true } } },
        }),
        tx.meeting.findMany({ where: { organizationId: orgId, eventId }, select: { status: true } }),
        tx.introductionRequest.findMany({ where: { organizationId: orgId, eventId }, select: { status: true } }),
        tx.checkIn.count({ where: { organizationId: orgId, eventId } }),
      ]);

      const confirmed = registrations.filter((r) => r.status === 'CONFIRMED').length;
      const byCategory = tally(registrations.map((r) => r.category.name));
      const byDay = tally(registrations.map((r) => r.createdAt.toISOString().slice(0, 10)));

      return {
        registrations: {
          total: registrations.length,
          byStatus: tally(registrations.map((r) => r.status)),
          byCategory: Object.entries(byCategory).map(([categoryName, count]) => ({ categoryName, count })),
        },
        attendance: { checkedIn, rate: confirmed === 0 ? 0 : Math.round((checkedIn / confirmed) * 1000) / 10 },
        meetings: tally(meetings.map((m) => m.status)),
        introductions: tally(introductions.map((i) => i.status)),
        registrationsByDay: Object.entries(byDay)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([day, count]) => ({ day, count })),
      };
    });
  }

  organisationOverview(): Promise<OrganisationOverview> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const orgId = tenant.organizationId;
      const [events, registrations, checkedIn] = await Promise.all([
        tx.event.findMany({
          where: { organizationId: orgId },
          orderBy: { startsAt: 'desc' },
          select: { id: true, name: true, status: true, startsAt: true, _count: { select: { registrations: true } } },
        }),
        tx.registration.count({ where: { organizationId: orgId } }),
        tx.checkIn.count({ where: { organizationId: orgId } }),
      ]);

      return {
        events: { total: events.length, byStatus: tally(events.map((e) => e.status)) },
        registrations,
        checkedIn,
        recentEvents: events.slice(0, 8).map((e) => ({
          id: e.id,
          name: e.name,
          status: e.status,
          startsAt: e.startsAt.toISOString(),
          registrations: e._count.registrations,
        })),
      };
    });
  }

  /** Compares an event with the other editions in its family (same parent or its parent). */
  editionComparison(eventId: string): Promise<EditionComparison> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const event = await this.requireEvent(tx, tenant.organizationId, eventId);
      const rootId = event.parentEventId ?? event.id;
      const family = await tx.event.findMany({
        where: { organizationId: tenant.organizationId, OR: [{ id: rootId }, { parentEventId: rootId }] },
        orderBy: { startsAt: 'asc' },
        select: { id: true, name: true, startsAt: true, _count: { select: { registrations: true, ...{} } } },
      });
      const attendance = await tx.checkIn.groupBy({
        by: ['eventId'],
        where: { organizationId: tenant.organizationId, eventId: { in: family.map((e) => e.id) } },
        _count: { _all: true },
      });
      const attended = new Map(attendance.map((a) => [a.eventId, a._count._all]));

      return {
        editions: family.map((e) => ({
          eventId: e.id,
          name: e.name,
          startsAt: e.startsAt.toISOString(),
          registrations: e._count.registrations,
          checkedIn: attended.get(e.id) ?? 0,
        })),
      };
    });
  }

  registrationsCsv(eventId: string): Promise<string> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      await this.requireEvent(tx, tenant.organizationId, eventId);
      const rows = await tx.registration.findMany({
        where: { organizationId: tenant.organizationId, eventId },
        orderBy: { createdAt: 'asc' },
        select: {
          status: true,
          createdAt: true,
          person: { select: { firstName: true, lastName: true, email: true, phone: true } },
          category: { select: { name: true } },
          _count: { select: { checkIns: true } },
        },
      });
      return toCsv(
        ['first_name', 'last_name', 'email', 'phone', 'category', 'status', 'checked_in', 'registered_at'],
        rows.map((r) => [
          r.person.firstName,
          r.person.lastName,
          r.person.email,
          r.person.phone,
          r.category.name,
          r.status,
          r._count.checkIns > 0 ? 'yes' : 'no',
          r.createdAt.toISOString(),
        ]),
      );
    });
  }

  /** Public figures: aggregate only, and small groups are suppressed. */
  async publicStats(eventSlug: string): Promise<PublicEventStats> {
    const event = await this.prisma.event.findFirst({
      where: { slug: eventSlug, visibility: 'PUBLIC' },
      select: { id: true, organizationId: true },
    });
    if (!event) {
      throw AppException.notFound('not_found', 'Event not found.');
    }

    return this.tenantTransaction.withOrganization(event.organizationId, null, async (tx) => {
      const rows = await tx.registration.findMany({
        where: { organizationId: event.organizationId, eventId: event.id, status: 'CONFIRMED' },
        select: { category: { select: { name: true } } },
      });
      const byCategory = tally(rows.map((r) => r.category.name));
      return {
        registrations: publishableCount(rows.length),
        byCategory: Object.entries(byCategory).map(([categoryName, count]) => ({
          categoryName,
          count: publishableCount(count),
        })),
      };
    });
  }

  private async requireEvent(tx: TenantPrismaClient, organizationId: string, eventId: string) {
    const event = await tx.event.findFirst({
      where: { id: eventId, organizationId },
      select: { id: true, parentEventId: true },
    });
    if (!event) {
      throw AppException.notFound('not_found', 'Event not found.');
    }
    return event;
  }
}
