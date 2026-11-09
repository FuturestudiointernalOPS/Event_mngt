import { Injectable } from '@nestjs/common';
import type {
  CreateEditionRequest,
  EventDetail,
  EventSummary,
  ListEditionsQuery,
} from '@event-platform/shared';
import { AppException } from '../../common/app-exception';
import type { PaginatedResult } from '../../common/types/authenticated-user';
import { ensureUniqueSlug, slugify } from '../../common/utils/slug';
import { TenantTransactionService } from '../../database/tenant-transaction.service';
import { INITIAL_MODULE_KEYS } from './events.constants';
import { toDetail, toSummary } from './events.mapper';
import { EditionsRepository } from './editions.repository';
import { assertCanBeParent } from './editions.rules';

/**
 * Editions of one recurring programme.
 *
 * An edition is an event row linked by `parent_event_id`; it owns its dates, venue,
 * visibility, modules and (later) registrations. Nothing is inherited silently.
 */
@Injectable()
export class EditionsService {
  constructor(
    private readonly tenantTransaction: TenantTransactionService,
    private readonly editions: EditionsRepository,
  ) {}

  async create(
    parentEventId: string,
    input: CreateEditionRequest,
    userId: string,
  ): Promise<EventDetail> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const parent = await this.editions.findParent(
        tx,
        tenant.organizationId,
        parentEventId,
      );

      if (!parent) {
        throw AppException.notFound('not_found', 'Event not found.');
      }

      assertCanBeParent(parent);

      const slug = input.slug
        ? slugify(input.slug)
        : await ensureUniqueSlug(input.name, async (candidate) => {
            const found = await this.editions.findSlugConflict(
              tx,
              tenant.organizationId,
              candidate,
            );
            return found !== null;
          });

      const clash = await this.editions.findSlugConflict(
        tx,
        tenant.organizationId,
        slug,
      );

      if (clash) {
        throw AppException.conflict(
          'slug_taken',
          'An event with this web address already exists in this workspace.',
        );
      }

      const created = await this.editions.create(tx, {
        organizationId: tenant.organizationId,
        createdByUserId: userId,
        parentEventId,
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

  async list(
    parentEventId: string,
    query: ListEditionsQuery,
  ): Promise<PaginatedResult<EventSummary>> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const parent = await this.editions.findParent(
        tx,
        tenant.organizationId,
        parentEventId,
      );

      if (!parent) {
        throw AppException.notFound('not_found', 'Event not found.');
      }

      const [rows, total] = await this.editions.list(
        tx,
        tenant.organizationId,
        parentEventId,
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

  async getOne(parentEventId: string, editionId: string): Promise<EventDetail> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const parent = await this.editions.findParent(
        tx,
        tenant.organizationId,
        parentEventId,
      );

      if (!parent) {
        throw AppException.notFound('not_found', 'Event not found.');
      }

      const edition = await this.editions.findById(
        tx,
        tenant.organizationId,
        parentEventId,
        editionId,
      );

      if (!edition) {
        throw AppException.notFound('not_found', 'Edition not found.');
      }

      return toDetail(edition);
    });
  }
}
