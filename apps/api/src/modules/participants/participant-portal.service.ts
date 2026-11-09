import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { writeAudit } from '../../common/audit/audit';
import { signBadge } from '../../common/utils/badge';
import { resolveBadgeSecret } from '../../common/utils/badge-secret';
import type { ParticipantAccess } from '../../common/types/authenticated-user';
import type { Env } from '../../config/env.validation';
import { TenantTransactionService } from '../../database/tenant-transaction.service';
import { assertCanSelfCancel } from './participants.rules';

export interface ParticipantOverview {
  registrationId: string;
  status: string;
  firstName: string;
  lastName: string;
  categoryName: string;
  event: {
    name: string;
    slug: string;
    startsAt: string;
    endsAt: string;
    timeZone: string;
    venueName: string | null;
    venueAddress: string | null;
  };
  /** The QR payload. Only present once the registration is confirmed. */
  badgeCode: string | null;
  checkedIn: boolean;
  modules: string[];
}

export function nameOf(person: { firstName: string; lastName: string }): string {
  return `${person.firstName} ${person.lastName}`;
}

/** The participant's overview, including the QR badge payload. */
@Injectable()
export class ParticipantPortalService {
  constructor(
    private readonly tenantTransaction: TenantTransactionService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  overview(participant: ParticipantAccess): Promise<ParticipantOverview> {
    return this.tenantTransaction.withTenant(async (tx) => {
      const row = await tx.registration.findFirstOrThrow({
        where: { id: participant.registrationId, organizationId: participant.organizationId },
        select: {
          id: true,
          status: true,
          person: { select: { firstName: true, lastName: true } },
          category: { select: { name: true } },
          _count: { select: { checkIns: true } },
          event: {
            select: {
              name: true,
              slug: true,
              startsAt: true,
              endsAt: true,
              timeZone: true,
              venueName: true,
              venueAddress: true,
              modules: { where: { enabled: true }, select: { moduleKey: true } },
            },
          },
        },
      });

      const secret = resolveBadgeSecret(
        this.config.get('BADGE_SIGNING_SECRET', { infer: true }),
        this.config.get('JWT_ACCESS_SECRET', { infer: true }),
      );

      return {
        registrationId: row.id,
        status: row.status,
        firstName: row.person.firstName,
        lastName: row.person.lastName,
        categoryName: row.category.name,
        event: {
          name: row.event.name,
          slug: row.event.slug,
          startsAt: row.event.startsAt.toISOString(),
          endsAt: row.event.endsAt.toISOString(),
          timeZone: row.event.timeZone,
          venueName: row.event.venueName,
          venueAddress: row.event.venueAddress,
        },
        badgeCode:
          row.status === 'CONFIRMED' ? signBadge(secret, participant.organizationId, row.id) : null,
        checkedIn: row._count.checkIns > 0,
        modules: row.event.modules.map((m) => m.moduleKey),
      };
    });
  }

  /** Withdraws the participant's own registration. The portal credential stops working. */
  cancel(participant: ParticipantAccess): Promise<{ status: string }> {
    return this.tenantTransaction.withTenant(async (tx) => {
      const row = await tx.registration.findFirstOrThrow({
        where: { id: participant.registrationId, organizationId: participant.organizationId },
        select: { status: true, _count: { select: { checkIns: true } } },
      });
      assertCanSelfCancel(row.status, row._count.checkIns);

      await tx.registration.update({
        where: { id: participant.registrationId },
        data: { status: 'CANCELLED', decidedAt: new Date(), decisionNote: 'Cancelled by the participant' },
      });
      await writeAudit(tx, {
        organizationId: participant.organizationId,
        action: 'registration.self_cancelled',
        targetType: 'registration',
        targetId: participant.registrationId,
      });
      return { status: 'CANCELLED' };
    });
  }
}
