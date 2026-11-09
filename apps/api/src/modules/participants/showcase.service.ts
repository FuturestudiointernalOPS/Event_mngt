import { Injectable } from '@nestjs/common';
import type { InnovationView, ModerationDecision, ProfileView, PublicShowcase } from '@event-platform/shared';
import { writeAudit } from '../../common/audit/audit';
import { AppException } from '../../common/app-exception';
import { requireModule } from '../../common/utils/event-modules';
import { PrismaService } from '../../database/prisma.service';
import { TenantTransactionService } from '../../database/tenant-transaction.service';
import { nameOf } from './participant-portal.service';

const PERSON = { select: { person: { select: { firstName: true, lastName: true } } } } as const;

/** Staff moderation of profiles and innovations, and the public showcase read model. */
@Injectable()
export class ShowcaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantTransaction: TenantTransactionService,
  ) {}

  listProfiles(eventId: string): Promise<ProfileView[]> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const rows = await tx.participantProfile.findMany({
        where: { organizationId: tenant.organizationId, eventId },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        include: { registration: PERSON },
      });
      return rows.map((r) => ({
        id: r.id,
        registrationId: r.registrationId,
        name: nameOf(r.registration.person),
        headline: r.headline,
        bio: r.bio,
        tags: r.tags,
        isVisible: r.isVisible,
        status: r.status,
      }));
    });
  }

  listInnovations(eventId: string): Promise<InnovationView[]> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const rows = await tx.innovation.findMany({
        where: { organizationId: tenant.organizationId, eventId },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        include: { owner: PERSON },
      });
      return rows.map((r) => ({
        id: r.id,
        ownerRegistrationId: r.ownerRegistrationId,
        ownerName: nameOf(r.owner.person),
        title: r.title,
        summary: r.summary,
        sector: r.sector,
        tags: r.tags,
        isVisible: r.isVisible,
        status: r.status,
      }));
    });
  }

  moderate(kind: 'profiles' | 'innovations', eventId: string, id: string, input: ModerationDecision): Promise<void> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const status = input.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
      const where = { id, eventId, organizationId: tenant.organizationId };
      const result =
        kind === 'profiles'
          ? await tx.participantProfile.updateMany({ where, data: { status } })
          : await tx.innovation.updateMany({ where, data: { status } });
      if (result.count === 0) {
        throw AppException.notFound('not_found', 'Listing not found.');
      }
      await writeAudit(tx, {
        organizationId: tenant.organizationId,
        actorUserId: tenant.userId,
        action: `showcase.${input.decision.toLowerCase()}`,
        targetType: kind,
        targetId: id,
      });
    });
  }

  /**
   * Public showcase: approved AND visible listings of a published public event whose
   * showcase module is on. Only display fields are returned — never contact details.
   */
  async publicShowcase(eventSlug: string): Promise<PublicShowcase> {
    const event = await this.prisma.event.findFirst({
      where: { slug: eventSlug, visibility: { in: ['PUBLIC'] } },
      select: { id: true, organizationId: true },
    });
    if (!event) {
      throw AppException.notFound('not_found', 'Event not found.');
    }

    return this.tenantTransaction.withOrganization(event.organizationId, null, async (tx) => {
      await requireModule(tx, event.id, 'showcase');
      const where = { organizationId: event.organizationId, eventId: event.id, status: 'APPROVED' as const, isVisible: true };
      const [profiles, innovations] = await Promise.all([
        tx.participantProfile.findMany({ where, orderBy: { headline: 'asc' }, include: { registration: PERSON } }),
        tx.innovation.findMany({ where, orderBy: { title: 'asc' }, include: { owner: PERSON } }),
      ]);
      return {
        profiles: profiles.map((p) => ({ name: nameOf(p.registration.person), headline: p.headline, bio: p.bio, tags: p.tags })),
        innovations: innovations.map((i) => ({ id: i.id, title: i.title, summary: i.summary, sector: i.sector, tags: i.tags, ownerName: nameOf(i.owner.person) })),
      };
    });
  }
}
