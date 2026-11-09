import { Injectable } from '@nestjs/common';
import type {
  AssignIntroductionRequest,
  DecideIntroductionRequest,
  IntroductionView,
  ListIntroductionsQuery,
  RequestIntroductionRequest,
} from '@event-platform/shared';
import { writeAudit } from '../../common/audit/audit';
import { AppException } from '../../common/app-exception';
import { requireModule } from '../../common/utils/event-modules';
import type { ParticipantAccess, PaginatedResult } from '../../common/types/authenticated-user';
import { TenantTransactionService } from '../../database/tenant-transaction.service';
import type { TenantPrismaClient } from '../../database/tenant-transaction.service';
import { nameOf } from './participant-portal.service';
import {
  assertCanRequestIntroduction,
  assertConfirmed,
  assertIntroductionTransition,
} from './participants.rules';

const OPEN_STATUSES = ['SUBMITTED', 'IN_REVIEW', 'APPROVED'] as const;

const INCLUDE = {
  innovation: { select: { title: true } },
  history: { orderBy: { createdAt: 'asc' as const } },
} as const;

type Row = Awaited<ReturnType<IntroductionsService['fetch']>>[number];

/** The introduction queue: participants request, staff review, assign and decide. */
@Injectable()
export class IntroductionsService {
  constructor(private readonly tenantTransaction: TenantTransactionService) {}

  request(participant: ParticipantAccess, input: RequestIntroductionRequest): Promise<IntroductionView> {
    return this.tenantTransaction.withTenant(async (tx) => {
      assertConfirmed(participant.status);
      await requireModule(tx, participant.eventId, 'introductions');

      const innovation = await tx.innovation.findFirst({
        where: {
          id: input.innovationId,
          eventId: participant.eventId,
          organizationId: participant.organizationId,
          status: 'APPROVED',
          isVisible: true,
        },
        select: { id: true, ownerRegistrationId: true },
      });
      if (!innovation) {
        throw AppException.notFound('not_found', 'Innovation not found.');
      }

      assertCanRequestIntroduction({
        requesterId: participant.registrationId,
        ownerId: innovation.ownerRegistrationId,
        innovationApproved: true,
        openRequestExists:
          (await tx.introductionRequest.count({
            where: {
              innovationId: innovation.id,
              requesterRegistrationId: participant.registrationId,
              status: { in: [...OPEN_STATUSES] },
            },
          })) > 0,
      });

      const created = await tx.introductionRequest.create({
        data: {
          organizationId: participant.organizationId,
          eventId: participant.eventId,
          innovationId: innovation.id,
          requesterRegistrationId: participant.registrationId,
          reason: input.reason,
          helpOffered: input.helpOffered,
          history: { create: { organizationId: participant.organizationId, toStatus: 'SUBMITTED' } },
        },
      });

      return (await this.views(tx, participant.organizationId, [created.id]))[0];
    });
  }

  listMine(participant: ParticipantAccess): Promise<IntroductionView[]> {
    return this.tenantTransaction.withTenant(async (tx) => {
      assertConfirmed(participant.status);
      const rows = await tx.introductionRequest.findMany({
        where: {
          organizationId: participant.organizationId,
          requesterRegistrationId: participant.registrationId,
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
      return this.views(tx, participant.organizationId, rows.map((r) => r.id));
    });
  }

  /* ------------------------------------------------------------------- staff */

  list(eventId: string, query: ListIntroductionsQuery): Promise<PaginatedResult<IntroductionView>> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const where = {
        organizationId: tenant.organizationId,
        eventId,
        ...(query.status && { status: query.status }),
        ...(query.assignedToMe && { assignedToUserId: tenant.userId }),
      };
      const [rows, total] = await Promise.all([
        tx.introductionRequest.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          select: { id: true },
        }),
        tx.introductionRequest.count({ where }),
      ]);
      return {
        items: await this.views(tx, tenant.organizationId, rows.map((r) => r.id)),
        page: query.page,
        pageSize: query.pageSize,
        total,
      };
    });
  }

  assign(eventId: string, id: string, input: AssignIntroductionRequest): Promise<IntroductionView> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      if (input.userId) {
        const member = await tx.organizationMember.findFirst({
          where: { organizationId: tenant.organizationId, userId: input.userId, status: 'ACTIVE' },
          select: { id: true },
        });
        if (!member) {
          throw AppException.badRequest('invalid_assignee', 'This person is not on the team.');
        }
      }
      const result = await tx.introductionRequest.updateMany({
        where: { id, eventId, organizationId: tenant.organizationId },
        data: { assignedToUserId: input.userId },
      });
      if (result.count === 0) {
        throw AppException.notFound('not_found', 'Request not found.');
      }
      return (await this.views(tx, tenant.organizationId, [id]))[0];
    });
  }

  decide(eventId: string, id: string, input: DecideIntroductionRequest): Promise<IntroductionView> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const current = await tx.introductionRequest.findFirst({
        where: { id, eventId, organizationId: tenant.organizationId },
        select: { id: true, status: true },
      });
      if (!current) {
        throw AppException.notFound('not_found', 'Request not found.');
      }

      assertIntroductionTransition(current.status, input.status, input.outcome);

      await tx.introductionRequest.update({
        where: { id },
        data: {
          status: input.status,
          decisionNote: input.note ?? undefined,
          outcome: input.outcome ?? undefined,
          history: {
            create: {
              organizationId: tenant.organizationId,
              fromStatus: current.status,
              toStatus: input.status,
              changedByUserId: tenant.userId,
              note: input.note ?? null,
            },
          },
        },
      });
      await writeAudit(tx, {
        organizationId: tenant.organizationId,
        actorUserId: tenant.userId,
        action: 'introduction.status_changed',
        targetType: 'introduction',
        targetId: id,
        metadata: { from: current.status, to: input.status },
      });

      return (await this.views(tx, tenant.organizationId, [id]))[0];
    });
  }

  private fetch(tx: TenantPrismaClient, organizationId: string, ids: string[]) {
    return tx.introductionRequest.findMany({
      where: { id: { in: ids }, organizationId },
      include: INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  private async views(tx: TenantPrismaClient, organizationId: string, ids: string[]): Promise<IntroductionView[]> {
    if (ids.length === 0) {
      return [];
    }
    const rows: Row[] = await this.fetch(tx, organizationId, ids);
    const requesters = await tx.registration.findMany({
      where: { id: { in: rows.map((r) => r.requesterRegistrationId) }, organizationId },
      select: { id: true, person: { select: { firstName: true, lastName: true } } },
    });
    const names = new Map(requesters.map((r) => [r.id, nameOf(r.person)]));

    return rows.map((r) => ({
      id: r.id,
      innovationId: r.innovationId,
      innovationTitle: r.innovation.title,
      requesterRegistrationId: r.requesterRegistrationId,
      requesterName: names.get(r.requesterRegistrationId) ?? '',
      reason: r.reason,
      helpOffered: r.helpOffered,
      status: r.status,
      assignedToUserId: r.assignedToUserId,
      decisionNote: r.decisionNote,
      outcome: r.outcome,
      createdAt: r.createdAt.toISOString(),
      history: r.history.map((h) => ({
        fromStatus: h.fromStatus,
        toStatus: h.toStatus,
        note: h.note,
        createdAt: h.createdAt.toISOString(),
      })),
    }));
  }
}
