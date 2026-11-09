import { Injectable } from '@nestjs/common';
import {
  CreateEventRequest,
  EventDetail,
  EventSummary,
  ListEventsQuery,
} from '@event-platform/shared';
import { AppException } from '../../common/app-exception';
import { AUDIT_ACTIONS } from '../../common/audit/audit.actions';
import { AuditService } from '../../common/audit/audit.service';
import type { PaginatedResult } from '../../common/types/authenticated-user';
import { ensureUniqueSlug, slugify } from '../../common/utils/slug';
import { TenantTransactionService } from '../../database/tenant-transaction.service';
import { assertPublishable, shouldActivatePublishingModule } from './events.lifecycle';
import { toDetail, toSummary } from './events.mapper';
import { toPublicContext, type PublicEventContext } from './events.projection';
import { buildListWhere, buildOrderBy } from './events.query';
import { EventsRepository } from './events.repository';

export type { PublicEventContext } from './events.projection';

/** Modules every new event starts with. Publishing adds its own module later. */
const INITIAL_MODULE_KEYS = ['core', 'reporting'];

/**
 * Event container: lifecycle, visibility and editions.
 *
 * Rules and the transaction boundary live here; the query surface is in the repository.
 * All tenant-owned access runs through TenantTransactionService with explicit
 * organizationId predicates; row-level security is the second layer.
 */
@Injectable()
export class EventsService {
  constructor(
    private readonly tenantTransaction: TenantTransactionService,
    private readonly events: EventsRepository,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListEventsQuery): Promise<PaginatedResult<EventSummary>> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const [rows, total] = await this.events.list(
        tx,
        buildListWhere(query, tenant.organizationId),
        buildOrderBy(query.sort),
        (query.page - 1) * query.pageSize,
        query.pageSize,
      );

      return {
        items: rows.map(toSummary),
        page: query.page,
        pageSize: query.pageSize,
        total,
      };
    });
  }

  async create(input: CreateEventRequest, userId: string): Promise<EventDetail> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const slug = input.slug
        ? slugify(input.slug)
        : await ensureUniqueSlug(input.name, async (candidate) => {
            const found = await this.events.findSlugConflict(
              tx,
              tenant.organizationId,
              candidate,
            );
            return found !== null;
          });

      const clash = await this.events.findSlugConflict(tx, tenant.organizationId, slug);

      if (clash) {
        throw AppException.conflict(
          'slug_taken',
          'An event with this web address already exists in this workspace.',
        );
      }

      if (input.parentEventId) {
        const parent = await this.events.existsById(
          tx,
          tenant.organizationId,
          input.parentEventId,
        );
        if (!parent) {
          throw AppException.badRequest(
            'invalid_reference',
            'The parent event does not exist in this workspace.',
          );
        }
      }

      const created = await this.events.create(tx, {
        organizationId: tenant.organizationId,
        createdByUserId: userId,
        parentEventId: input.parentEventId ?? null,
        slug,
        name: input.name,
        description: input.description ?? null,
        format: input.format,
        visibility: input.visibility,
        timeZone: input.timeZone,
        startsAt: new Date(input.startsAt),
        endsAt: new Date(input.endsAt),
        venueName: input.venueName ?? null,
        venueAddress: input.venueAddress ?? null,
        initialModuleKeys: INITIAL_MODULE_KEYS,
      });

      return toDetail(created);
    });
  }

  async getById(eventId: string): Promise<EventDetail> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const event = await this.events.findById(tx, tenant.organizationId, eventId);

      if (!event) {
        throw AppException.notFound('not_found', 'Event not found.');
      }

      return toDetail(event);
    });
  }

  async publish(eventId: string): Promise<EventDetail> {
    const detail = await this.tenantTransaction.withTenant(async (tx, tenant) => {
      const event = await this.events.findStatus(tx, tenant.organizationId, eventId);

      if (!event) {
        throw AppException.notFound('not_found', 'Event not found.');
      }

      assertPublishable(event.status);

      if (shouldActivatePublishingModule(event.visibility)) {
        await this.events.enablePublishingModule(tx, event.id);
      }

      return toDetail(await this.events.publish(tx, event.id));
    });

    await this.audit.record({
      action: AUDIT_ACTIONS.eventPublished,
      targetType: 'event',
      targetId: eventId,
    });

    return detail;
  }

  /**
   * Public event context. Runs without a session: the event is located through the
   * public read policy, then the projection is read inside the organisation scope so
   * branding and settings stay protected. Visibility is enforced in both queries.
   */
  async getPublicContext(eventSlug: string): Promise<PublicEventContext> {
    const located = await this.events.findPublicEventLocation(eventSlug);

    if (!located) {
      throw AppException.notFound('not_found', 'Event not found.');
    }

    const row = await this.tenantTransaction.withOrganizationScope(
      located.organizationId,
      (tx) => this.events.findPublicContextById(tx, located.id, located.organizationId),
    );

    if (!row) {
      throw AppException.notFound('not_found', 'Event not found.');
    }

    return toPublicContext(row);
  }
}
