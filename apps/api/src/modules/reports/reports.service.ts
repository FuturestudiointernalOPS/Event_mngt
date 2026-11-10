import { Injectable } from '@nestjs/common';
import type {
  EditionComparison,
  EventReport,
  OrganizationReport,
} from '@event-platform/shared';
import { AppException } from '../../common/app-exception';
import { TenantTransactionService } from '../../database/tenant-transaction.service';
import { ReportsPortfolioRepository } from './reports-portfolio.repository';
import { ReportsRepository } from './reports.repository';
import {
  buildEditionEntries,
  buildOrganizationEvents,
  buildOrganizationTotals,
  buildTimeline,
  timelineSince,
} from './reports.rules';
import {
  approvalRate,
  sumStatusCounts,
  toBadgeCounts,
  toCategoryReport,
  toModerationCounts,
  toSourceCounts,
  toStatusCounts,
} from './reports.shapes';

/** The window the event dashboard chart shows. */
export const REPORT_TIMELINE_DAYS = 30;
export const REPORT_RECENT_DAYS = 7;

/**
 * Staff aggregates (WP-18).
 *
 * Each call runs in one tenant transaction. The service owns the transaction boundary
 * and the orchestration; the repository owns the grouped queries and the pure rules
 * shape the result.
 */
@Injectable()
export class ReportsService {
  constructor(
    private readonly tenantTransaction: TenantTransactionService,
    private readonly repository: ReportsRepository,
    private readonly portfolio: ReportsPortfolioRepository,
  ) {}

  eventSummary(eventId: string): Promise<EventReport> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const event = await this.repository.findEvent(
        tx,
        tenant.organizationId,
        eventId,
      );

      if (!event) {
        throw AppException.notFound('not_found', 'Event not found.');
      }

      const now = new Date();
      const sinceTimeline = timelineSince(REPORT_TIMELINE_DAYS, now);
      const sinceRecent = timelineSince(REPORT_RECENT_DAYS, now);

      const [
        statusRows,
        sourceRows,
        categoryRows,
        categories,
        participants,
        profiles,
        innovations,
        badges,
        last7Days,
        last30Days,
        timelineRows,
      ] = await Promise.all([
        this.repository.statusCounts(tx, tenant.organizationId, eventId),
        this.repository.sourceCounts(tx, tenant.organizationId, eventId),
        this.repository.categoryCounts(tx, tenant.organizationId, eventId),
        this.repository.listCategories(tx, tenant.organizationId, eventId),
        this.repository.participantStats(tx, tenant.organizationId, eventId),
        this.repository.profileCounts(tx, tenant.organizationId, eventId),
        this.repository.innovationCounts(tx, tenant.organizationId, eventId),
        this.repository.badgeCounts(tx, tenant.organizationId, eventId),
        this.repository.submittedSince(tx, tenant.organizationId, eventId, sinceRecent),
        this.repository.submittedSince(tx, tenant.organizationId, eventId, sinceTimeline),
        this.repository.timeline(tx, tenant.organizationId, eventId, sinceTimeline),
      ]);

      const byStatus = toStatusCounts(statusRows);

      return {
        event: {
          id: event.id,
          name: event.name,
          slug: event.slug,
          status: event.status,
          startsAt: event.startsAt.toISOString(),
          endsAt: event.endsAt.toISOString(),
        },
        generatedAt: now.toISOString(),
        registrations: {
          total: sumStatusCounts(byStatus),
          byStatus,
          bySource: toSourceCounts(sourceRows),
          byCategory: toCategoryReport(categoryRows, categories),
          last7Days,
          last30Days,
          approvalRate: approvalRate(byStatus),
        },
        participants,
        showcase: {
          profiles: toModerationCounts(profiles),
          innovations: toModerationCounts(innovations),
        },
        badges: toBadgeCounts(badges),
        timeline: buildTimeline(timelineRows, REPORT_TIMELINE_DAYS, now),
      };
    });
  }

  organizationSummary(): Promise<OrganizationReport> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const [events, counts] = await Promise.all([
        this.portfolio.eventsForOrganization(tx, tenant.organizationId),
        this.portfolio.organizationStatusCounts(tx, tenant.organizationId),
      ]);

      return {
        generatedAt: new Date().toISOString(),
        totals: buildOrganizationTotals(events, counts),
        events: buildOrganizationEvents(events, counts),
      };
    });
  }

  /**
   * Edition comparison for a family. Calling it with the parent or with any edition
   * resolves to the same root, so the screen does not depend on which event the user
   * happened to open.
   */
  editionComparison(eventId: string): Promise<EditionComparison> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const location = await this.portfolio.findEventLocation(
        tx,
        tenant.organizationId,
        eventId,
      );

      if (!location) {
        throw AppException.notFound('not_found', 'Event not found.');
      }

      const rootId = location.parentEventId ?? location.id;
      const root =
        rootId === location.id
          ? location
          : await this.portfolio.findEventLocation(tx, tenant.organizationId, rootId);

      const family = await this.portfolio.editionFamily(
        tx,
        tenant.organizationId,
        rootId,
      );
      const counts = await this.portfolio.eventStatusCounts(
        tx,
        tenant.organizationId,
        family.map((event) => event.id),
      );

      return {
        generatedAt: new Date().toISOString(),
        root: root ? { id: root.id, name: root.name, slug: root.slug } : null,
        editions: buildEditionEntries(family, counts),
      };
    });
  }
}
