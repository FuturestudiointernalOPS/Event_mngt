import { Injectable } from '@nestjs/common';
import type {
  CreateInnovationRequest,
  Innovation,
  ListInnovationsQuery,
  ModerateProfileRequest,
} from '@event-platform/shared';
import { AppException } from '../../common/app-exception';
import type { PaginatedResult } from '../../common/types/authenticated-user';
import {
  TenantTransactionService,
  type TenantPrismaClient,
} from '../../database/tenant-transaction.service';
import { ModerationStatus } from '../../database/prisma-client';
import { ModuleRegistryService } from '../module-registry/module-registry.service';
import { toInnovation } from './profiles.mapper';
import { assertModeratable } from './profiles.rules';
import { ShowcaseRepository } from './showcase.repository';

/**
 * Showcase listings for one event (WP-14). A listing starts pending; only a staff
 * decision and a public visibility make it visible.
 */
@Injectable()
export class ShowcaseService {
  constructor(
    private readonly tenantTransaction: TenantTransactionService,
    private readonly repository: ShowcaseRepository,
    private readonly modules: ModuleRegistryService,
  ) {}

  list(
    eventId: string,
    query: ListInnovationsQuery,
  ): Promise<PaginatedResult<Innovation>> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      await this.assertEvent(tx, tenant.organizationId, eventId);

      const [rows, total] = await this.repository.list(
        tx,
        tenant.organizationId,
        eventId,
        query.moderationStatus,
        (query.page - 1) * query.pageSize,
        query.pageSize,
      );

      return {
        items: rows.map(toInnovation),
        page: query.page,
        pageSize: query.pageSize,
        total,
      };
    });
  }

  create(eventId: string, input: CreateInnovationRequest): Promise<Innovation> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      await this.modules.requireEnabledSettings(
        tx,
        tenant.organizationId,
        eventId,
        'showcase',
      );

      await this.assertOwner(tx, tenant.organizationId, eventId, input);

      const row = await this.repository.create(tx, {
        organizationId: tenant.organizationId,
        eventId,
        title: input.title,
        summary: input.summary ?? null,
        category: input.category ?? null,
        externalUrl: input.externalUrl ?? null,
        imageUrl: input.imageUrl ?? null,
        participantProfileId: input.participantProfileId ?? null,
        organizationProfileId: input.organizationProfileId ?? null,
        visibility: 'PUBLIC',
        moderationStatus: ModerationStatus.PENDING,
      });

      return toInnovation(row);
    });
  }

  moderate(
    eventId: string,
    innovationId: string,
    input: ModerateProfileRequest,
  ): Promise<Innovation> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const existing = await this.repository.find(
        tx,
        tenant.organizationId,
        eventId,
        innovationId,
      );

      if (!existing) {
        throw AppException.notFound('not_found', 'Listing not found.');
      }

      assertModeratable(existing.moderationStatus, input.decision);

      const row = await this.repository.update(
        tx,
        tenant.organizationId,
        eventId,
        innovationId,
        {
          moderationStatus: input.decision,
          moderatedAt: new Date(),
          moderatedByUserId: tenant.userId,
          moderationNote: input.note ?? null,
        },
      );

      return toInnovation(row);
    });
  }

  private async assertOwner(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
    input: CreateInnovationRequest,
  ): Promise<void> {
    if (input.participantProfileId) {
      const owner = await this.repository.findParticipantProfile(
        tx,
        organizationId,
        eventId,
        input.participantProfileId,
      );

      if (!owner) {
        throw AppException.notFound('not_found', 'Profile not found.');
      }

      return;
    }

    if (input.organizationProfileId) {
      const owner = await this.repository.findOrganizationProfile(
        tx,
        organizationId,
        input.organizationProfileId,
      );

      if (!owner) {
        throw AppException.notFound('not_found', 'Organization profile not found.');
      }

      return;
    }

    throw AppException.unprocessable(
      'invalid_reference',
      'Attach the listing to a participant or organisation profile.',
    );
  }

  private async assertEvent(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
  ): Promise<void> {
    const event = await tx.event.findFirst({
      where: { id: eventId, organizationId },
      select: { id: true },
    });

    if (!event) {
      throw AppException.notFound('not_found', 'Event not found.');
    }
  }
}
