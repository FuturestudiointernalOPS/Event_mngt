import { Injectable } from '@nestjs/common';
import { EventDetail, UpdateEventRequest } from '@event-platform/shared';
import { AppException } from '../../common/app-exception';
import { slugify, ensureUniqueSlug } from '../../common/utils/slug';
import { TenantTransactionService } from '../../database/tenant-transaction.service';
import { EventVisibility, Prisma } from '../../database/prisma-client';
import {
  assertDateRange,
  assertEditable,
  assertSlugChangeAllowed,
  resolveTransition,
  type EventTransition,
} from './events.lifecycle';
import { toDetail } from './events.mapper';
import { EventsRepository } from './events.repository';

/**
 * Changes to an existing event: edit, status transitions and duplication.
 * Creation, listing and publishing stay in EventsService.
 */
@Injectable()
export class EventChangesService {
  constructor(
    private readonly tenantTransaction: TenantTransactionService,
    private readonly events: EventsRepository,
  ) {}

  async update(eventId: string, input: UpdateEventRequest): Promise<EventDetail> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const event = await this.events.findById(tx, tenant.organizationId, eventId);

      if (!event) {
        throw AppException.notFound('not_found', 'Event not found.');
      }

      assertEditable(event.status);

      const slug = input.slug === undefined ? undefined : slugify(input.slug);
      const slugChanged = slug !== undefined && slug !== event.slug;
      assertSlugChangeAllowed(event.status, slugChanged);

      if (slugChanged) {
        const clash = await this.events.findSlugConflict(tx, tenant.organizationId, slug);
        if (clash) {
          throw AppException.conflict(
            'slug_taken',
            'An event with this web address already exists in this workspace.',
          );
        }
      }

      const startsAt = input.startsAt ? new Date(input.startsAt) : event.startsAt;
      const endsAt = input.endsAt ? new Date(input.endsAt) : event.endsAt;
      assertDateRange(startsAt, endsAt);

      const data: Prisma.EventUpdateInput = {
        ...(input.name !== undefined && { name: input.name }),
        ...(slugChanged && { slug }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.format !== undefined && { format: input.format }),
        ...(input.visibility !== undefined && { visibility: input.visibility }),
        ...(input.timeZone !== undefined && { timeZone: input.timeZone }),
        ...(input.venueName !== undefined && { venueName: input.venueName }),
        ...(input.venueAddress !== undefined && { venueAddress: input.venueAddress }),
        startsAt,
        endsAt,
      };

      return toDetail(await this.events.update(tx, event.id, data));
    });
  }

  async transition(eventId: string, transition: EventTransition): Promise<EventDetail> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const event = await this.events.findStatus(tx, tenant.organizationId, eventId);

      if (!event) {
        throw AppException.notFound('not_found', 'Event not found.');
      }

      const target = resolveTransition(transition, event.status);

      return toDetail(
        await this.events.setStatus(
          tx,
          event.id,
          target,
          transition === 'unpublish' ? null : undefined,
        ),
      );
    });
  }

  /**
   * A copy is always a private draft with no parent: it is a new event that happens to
   * start from the same setup, not an edition of the original.
   */
  async duplicate(eventId: string, userId: string): Promise<EventDetail> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const source = await this.events.findById(tx, tenant.organizationId, eventId);

      if (!source) {
        throw AppException.notFound('not_found', 'Event not found.');
      }

      const slug = await ensureUniqueSlug(`${source.slug}-copy`, async (candidate) => {
        const found = await this.events.findSlugConflict(tx, tenant.organizationId, candidate);
        return found !== null;
      });

      const created = await this.events.create(tx, {
        organizationId: tenant.organizationId,
        createdByUserId: userId,
        parentEventId: null,
        slug,
        name: `${source.name} (copy)`.slice(0, 180),
        description: source.description,
        format: source.format,
        visibility: EventVisibility.PRIVATE,
        timeZone: source.timeZone,
        startsAt: source.startsAt,
        endsAt: source.endsAt,
        venueName: source.venueName,
        venueAddress: source.venueAddress,
        initialModuleKeys: source.modules
          .filter((module) => module.enabled && module.moduleKey !== 'publishing')
          .map((module) => module.moduleKey),
      });

      return toDetail(created);
    });
  }
}
