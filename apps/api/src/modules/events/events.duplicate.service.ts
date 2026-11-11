import { Injectable } from '@nestjs/common';
import type { EventDetail } from '@event-platform/shared';
import { AppException } from '../../common/app-exception';
import { AUDIT_ACTIONS } from '../../common/audit/audit.actions';
import { AuditService } from '../../common/audit/audit.service';
import { ensureUniqueSlug } from '../../common/utils/slug';
import { EventVisibility } from '../../database/prisma-client';
import { TenantTransactionService } from '../../database/tenant-transaction.service';
import { createWithFreeSlug } from './event-slug-write';
import { toDetail } from './events.mapper';
import { EventsRepository } from './events.repository';

/**
 * Duplicating an event.
 *
 * A copy starts as a private draft with the same container and the same enabled modules.
 * Registrations, participants, profiles and reports are never copied: a duplicate is a
 * starting point, not a second copy of other people's data.
 */
@Injectable()
export class DuplicateEventService {
  constructor(
    private readonly tenantTransaction: TenantTransactionService,
    private readonly events: EventsRepository,
    private readonly audit: AuditService,
  ) {}

  duplicate(eventId: string, userId: string): Promise<EventDetail> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const source = await this.events.findById(tx, tenant.organizationId, eventId);

      if (!source) {
        throw AppException.notFound('not_found', 'Event not found.');
      }

      const name = `${source.name} (copie)`;
      const slug = await ensureUniqueSlug(name, async (candidate) =>
        (await this.events.findSlugConflict(tx, tenant.organizationId, candidate)) !== null,
      );

      const created = await createWithFreeSlug(
        (eventSlug) =>
          this.events.create(tx, {
            organizationId: tenant.organizationId,
            createdByUserId: userId,
            parentEventId: source.parentEventId,
            slug: eventSlug,
            name,
            description: source.description,
            format: source.format,
            visibility: EventVisibility.PRIVATE,
            timeZone: source.timeZone,
            startsAt: source.startsAt,
            endsAt: source.endsAt,
            venueName: source.venueName,
            venueAddress: source.venueAddress,
            initialModuleKeys: source.modules
              .filter((module) => module.enabled)
              .map((module) => module.moduleKey),
          }),
        slug,
      );

      await this.audit.record({
        action: AUDIT_ACTIONS.eventDuplicated,
        targetType: 'event',
        targetId: created.id,
        metadata: { sourceEventId: eventId },
      });

      return toDetail(created);
    });
  }
}
