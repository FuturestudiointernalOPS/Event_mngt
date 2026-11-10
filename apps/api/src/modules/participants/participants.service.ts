import { Injectable } from '@nestjs/common';
import type {
  ListParticipantsQuery,
  ParticipantDetail,
  ParticipantSummary,
} from '@event-platform/shared';
import { AppException } from '../../common/app-exception';
import type { PaginatedResult } from '../../common/types/authenticated-user';
import {
  TenantTransactionService,
  type TenantPrismaClient,
} from '../../database/tenant-transaction.service';
import { toParticipantDetail, toParticipantSummary } from './participants.mapper';
import { ParticipantsRepository } from './participants.repository';

/** People who registered for one event (WP-14). */
@Injectable()
export class ParticipantsService {
  constructor(
    private readonly tenantTransaction: TenantTransactionService,
    private readonly repository: ParticipantsRepository,
  ) {}

  list(
    eventId: string,
    query: ListParticipantsQuery,
  ): Promise<PaginatedResult<ParticipantSummary>> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      await this.assertEvent(tx, tenant.organizationId, eventId);

      const [rows, total] = await this.repository.list(
        tx,
        tenant.organizationId,
        eventId,
        query.search,
        (query.page - 1) * query.pageSize,
        query.pageSize,
      );

      return {
        items: rows.map(toParticipantSummary),
        page: query.page,
        pageSize: query.pageSize,
        total,
      };
    });
  }

  detail(eventId: string, personId: string): Promise<ParticipantDetail> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const row = await this.repository.find(
        tx,
        tenant.organizationId,
        eventId,
        personId,
      );

      if (!row) {
        throw AppException.notFound('not_found', 'Participant not found.');
      }

      return toParticipantDetail(row);
    });
  }

  private async assertEvent(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
  ): Promise<void> {
    const event = await this.repository.eventExists(
      tx,
      organizationId,
      eventId,
    );

    if (!event) {
      throw AppException.notFound('not_found', 'Event not found.');
    }
  }
}
