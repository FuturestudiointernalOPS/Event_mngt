import { Injectable } from '@nestjs/common';
import {
  CreateEventRequest,
  EventDetail,
  EventSummary,
  ListEventsQuery,
} from '@event-platform/shared';
import { writeAudit } from '../../common/audit/audit';
import { AppException } from '../../common/app-exception';
import { isUniqueViolation, randomSuffix } from '../../common/utils/unique';
import type { PaginatedResult } from '../../common/types/authenticated-user';
import { ensureUniqueSlug, slugify } from '../../common/utils/slug';
import { TenantTransactionService } from '../../database/tenant-transaction.service';
import { assertPublishable, assertReadyToPublish, shouldActivatePublishingModule } from './events.lifecycle';
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

  /**
   * Public URLs are /e/:eventSlug, so slugs are unique platform-wide. Another
   * organisation's slug is invisible to us (row-level security), so a generated slug that
   * collides is retried with a random suffix; an explicit one is reported as taken.
   */
  async create(input: CreateEventRequest, userId: string): Promise<EventDetail> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await this.createOnce(input, userId, attempt);
      } catch (error) {
        if (!isUniqueViolation(error)) {
          throw error;
        }
        if (input.slug || attempt >= 3) {
          throw AppException.conflict(
            'slug_taken',
            'An event with this web address already exists.',
          );
        }
      }
    }
  }

  private async createOnce(
    input: CreateEventRequest,
    userId: string,
    attempt: number,
  ): Promise<EventDetail> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const generated = input.slug
        ? slugify(input.slug)
        : await ensureUniqueSlug(input.name, async (candidate) => {
            const found = await this.events.findSlugConflict(
              tx,
              tenant.organizationId,
              candidate,
            );
            return found !== null;
          });
      const slug = attempt > 0 ? `${generated}-${randomSuffix()}` : generated;

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

      await writeAudit(tx, {
        organizationId: tenant.organizationId,
        actorUserId: userId,
        action: 'event.created',
        targetType: 'event',
        targetId: created.id,
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
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const event = await this.events.findStatus(tx, tenant.organizationId, eventId);

      if (!event) {
        throw AppException.notFound('not_found', 'Event not found.');
      }

      assertPublishable(event.status);
      assertReadyToPublish(await this.events.publishReadiness(tx, tenant.organizationId, event.id));

      if (shouldActivatePublishingModule(event.visibility)) {
        await this.events.enablePublishingModule(tx, event.id);
      }

      const published = await this.events.publish(tx, event.id);
      await writeAudit(tx, {
        organizationId: tenant.organizationId,
        actorUserId: tenant.userId,
        action: 'event.published',
        targetType: 'event',
        targetId: event.id,
      });
      return toDetail(published);
    });
  }

  /**
   * Public event context. Runs without a session: the projection is explicit and
   * visibility is enforced in the query, never by hiding fields in the client.
   */
  async getPublicContext(eventSlug: string): Promise<PublicEventContext> {
    const row = await this.events.findPublicContext(eventSlug);

    if (!row) {
      throw AppException.notFound('not_found', 'Event not found.');
    }

    return toPublicContext(row);
  }
}
