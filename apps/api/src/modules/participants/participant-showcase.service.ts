import { Injectable } from '@nestjs/common';
import type {
  DirectoryEntry,
  InnovationInput,
  InnovationView,
  ProfileView,
  UpsertProfileRequest,
} from '@event-platform/shared';
import { AppException } from '../../common/app-exception';
import { requireModule } from '../../common/utils/event-modules';
import type { ParticipantAccess } from '../../common/types/authenticated-user';
import { TenantTransactionService } from '../../database/tenant-transaction.service';
import type { TenantPrismaClient } from '../../database/tenant-transaction.service';
import { nameOf } from './participant-portal.service';
import { assertConfirmed } from './participants.rules';

/** A participant's own showcase content: profile, innovations and the directory. */
@Injectable()
export class ParticipantShowcaseService {
  constructor(private readonly tenantTransaction: TenantTransactionService) {}

  /* ----------------------------------------------------------------- profile */

  getProfile(participant: ParticipantAccess): Promise<ProfileView | null> {
    return this.tenantTransaction.withTenant(async (tx) => {
      await this.requireShowcase(tx, participant);
      const row = await tx.participantProfile.findFirst({
        where: { registrationId: participant.registrationId, organizationId: participant.organizationId },
        include: { registration: { select: { person: { select: { firstName: true, lastName: true } } } } },
      });
      return row ? this.toProfile(row, nameOf(row.registration.person)) : null;
    });
  }

  upsertProfile(participant: ParticipantAccess, input: UpsertProfileRequest): Promise<ProfileView> {
    return this.tenantTransaction.withTenant(async (tx) => {
      const settings = await this.requireShowcase(tx, participant);
      this.assertEditable(settings);

      const status = settings.publicByDefault === true ? 'APPROVED' : 'PENDING';
      const data = { headline: input.headline, bio: input.bio ?? null, tags: input.tags, isVisible: input.isVisible, status } as const;

      const row = await tx.participantProfile.upsert({
        where: { registrationId: participant.registrationId },
        create: {
          organizationId: participant.organizationId,
          eventId: participant.eventId,
          registrationId: participant.registrationId,
          ...data,
        },
        update: data,
        include: { registration: { select: { person: { select: { firstName: true, lastName: true } } } } },
      });

      return this.toProfile(row, nameOf(row.registration.person));
    });
  }

  /* ------------------------------------------------------------- innovations */

  listInnovations(participant: ParticipantAccess): Promise<InnovationView[]> {
    return this.tenantTransaction.withTenant(async (tx) => {
      await this.requireShowcase(tx, participant);
      const rows = await tx.innovation.findMany({
        where: { ownerRegistrationId: participant.registrationId, organizationId: participant.organizationId },
        orderBy: { createdAt: 'desc' },
        include: { owner: { select: { person: { select: { firstName: true, lastName: true } } } } },
      });
      return rows.map((row) => this.toInnovation(row, nameOf(row.owner.person)));
    });
  }

  saveInnovation(
    participant: ParticipantAccess,
    input: InnovationInput,
    innovationId?: string,
  ): Promise<InnovationView> {
    return this.tenantTransaction.withTenant(async (tx) => {
      const settings = await this.requireShowcase(tx, participant);
      this.assertEditable(settings);

      const status = settings.publicByDefault === true ? 'APPROVED' : 'PENDING';
      const data = {
        title: input.title,
        summary: input.summary,
        sector: input.sector ?? null,
        tags: input.tags,
        isVisible: input.isVisible,
        status,
      } as const;
      const include = { owner: { select: { person: { select: { firstName: true, lastName: true } } } } };

      if (innovationId) {
        const owned = await tx.innovation.findFirst({
          where: { id: innovationId, ownerRegistrationId: participant.registrationId, organizationId: participant.organizationId },
          select: { id: true },
        });
        if (!owned) {
          throw AppException.notFound('not_found', 'Innovation not found.');
        }
        const row = await tx.innovation.update({ where: { id: innovationId }, data, include });
        return this.toInnovation(row, nameOf(row.owner.person));
      }

      const row = await tx.innovation.create({
        data: {
          organizationId: participant.organizationId,
          eventId: participant.eventId,
          ownerRegistrationId: participant.registrationId,
          ...data,
        },
        include,
      });
      return this.toInnovation(row, nameOf(row.owner.person));
    });
  }

  deleteInnovation(participant: ParticipantAccess, innovationId: string): Promise<void> {
    return this.tenantTransaction.withTenant(async (tx) => {
      await this.requireShowcase(tx, participant);
      const result = await tx.innovation.deleteMany({
        where: { id: innovationId, ownerRegistrationId: participant.registrationId, organizationId: participant.organizationId },
      });
      if (result.count === 0) {
        throw AppException.notFound('not_found', 'Innovation not found.');
      }
    });
  }

  /** Approved, visible innovations of other participants: what an introduction can target. */
  approvedInnovations(participant: ParticipantAccess): Promise<InnovationView[]> {
    return this.tenantTransaction.withTenant(async (tx) => {
      await this.requireShowcase(tx, participant);
      const rows = await tx.innovation.findMany({
        where: {
          organizationId: participant.organizationId,
          eventId: participant.eventId,
          status: 'APPROVED',
          isVisible: true,
          ownerRegistrationId: { not: participant.registrationId },
        },
        orderBy: { title: 'asc' },
        include: { owner: { select: { person: { select: { firstName: true, lastName: true } } } } },
      });
      return rows.map((row) => this.toInnovation(row, nameOf(row.owner.person)));
    });
  }

  /* --------------------------------------------------------------- directory */

  directory(participant: ParticipantAccess): Promise<DirectoryEntry[]> {
    return this.tenantTransaction.withTenant(async (tx) => {
      await this.requireShowcase(tx, participant);
      const rows = await tx.participantProfile.findMany({
        where: {
          organizationId: participant.organizationId,
          eventId: participant.eventId,
          status: 'APPROVED',
          isVisible: true,
          registrationId: { not: participant.registrationId },
          registration: { status: 'CONFIRMED' },
        },
        orderBy: { headline: 'asc' },
        include: { registration: { select: { person: { select: { firstName: true, lastName: true } } } } },
      });
      return rows.map((row) => ({
        registrationId: row.registrationId,
        name: nameOf(row.registration.person),
        headline: row.headline,
        tags: row.tags,
      }));
    });
  }

  private async requireShowcase(tx: TenantPrismaClient, participant: ParticipantAccess) {
    assertConfirmed(participant.status);
    return requireModule(tx, participant.eventId, 'showcase');
  }

  private assertEditable(settings: Record<string, unknown>): void {
    if (settings.allowParticipantEditing === false) {
      throw AppException.forbidden('editing_disabled', 'Editing is disabled for this event.');
    }
  }

  private toProfile(
    row: { id: string; registrationId: string; headline: string; bio: string | null; tags: string[]; isVisible: boolean; status: ProfileView['status'] },
    name: string,
  ): ProfileView {
    return { id: row.id, registrationId: row.registrationId, name, headline: row.headline, bio: row.bio, tags: row.tags, isVisible: row.isVisible, status: row.status };
  }

  private toInnovation(
    row: { id: string; ownerRegistrationId: string; title: string; summary: string; sector: string | null; tags: string[]; isVisible: boolean; status: InnovationView['status'] },
    ownerName: string,
  ): InnovationView {
    return { id: row.id, ownerRegistrationId: row.ownerRegistrationId, ownerName, title: row.title, summary: row.summary, sector: row.sector, tags: row.tags, isVisible: row.isVisible, status: row.status };
  }
}
