import { Injectable } from '@nestjs/common';
import type {
  ParticipantDataExport,
  PurgeResult,
  RetentionSettings,
} from '@event-platform/shared';
import { writeAudit } from '../../common/audit/audit';
import { AppException } from '../../common/app-exception';
import type { ParticipantAccess } from '../../common/types/authenticated-user';
import { TenantTransactionService } from '../../database/tenant-transaction.service';
import type { TenantPrismaClient } from '../../database/tenant-transaction.service';
import { anonymisedPerson, deadCredentialHash, retentionCutoff } from './data-rights.rules';

/**
 * Personal-data rights: export, erasure and time-based retention. Erasure anonymises the
 * person but keeps the registration and check-in rows, so counts and reports stay correct.
 */
@Injectable()
export class DataRightsService {
  constructor(private readonly tenantTransaction: TenantTransactionService) {}

  /** The participant's own data, as they would receive it on request. */
  exportMine(participant: ParticipantAccess): Promise<ParticipantDataExport> {
    return this.tenantTransaction.withTenant(async (tx) => {
      const orgId = participant.organizationId;
      const reg = await tx.registration.findFirstOrThrow({
        where: { id: participant.registrationId, organizationId: orgId },
        include: {
          person: true,
          category: { select: { name: true } },
          consents: { orderBy: { createdAt: 'asc' } },
          profile: true,
          innovations: true,
          checkIns: { select: { scannedAt: true }, take: 1 },
        },
      });
      const [meetings, intros] = await Promise.all([
        tx.meeting.findMany({
          where: {
            organizationId: orgId,
            OR: [{ proposerRegistrationId: reg.id }, { inviteeRegistrationId: reg.id }],
          },
        }),
        tx.introductionRequest.findMany({ where: { organizationId: orgId, requesterRegistrationId: reg.id } }),
      ]);

      return {
        exportedAt: new Date().toISOString(),
        person: { firstName: reg.person.firstName, lastName: reg.person.lastName, email: reg.person.email, phone: reg.person.phone },
        registration: { id: reg.id, status: reg.status, category: reg.category.name, answers: reg.answers as Record<string, unknown>, createdAt: reg.createdAt.toISOString() },
        consents: reg.consents.map((c) => ({ purpose: c.purpose, policyVersion: c.policyVersion, granted: c.granted, createdAt: c.createdAt.toISOString() })),
        profile: reg.profile ? { headline: reg.profile.headline, bio: reg.profile.bio, tags: reg.profile.tags } : null,
        innovations: reg.innovations.map((i) => ({ title: i.title, summary: i.summary, sector: i.sector })),
        meetings: meetings.map((m) => ({ message: m.message, status: m.status, createdAt: m.createdAt.toISOString() })),
        introductionRequests: intros.map((i) => ({ reason: i.reason, helpOffered: i.helpOffered, status: i.status, createdAt: i.createdAt.toISOString() })),
        checkedInAt: reg.checkIns[0]?.scannedAt.toISOString() ?? null,
      };
    });
  }

  /** Participant exercising their right to erasure. */
  eraseMine(participant: ParticipantAccess): Promise<void> {
    return this.tenantTransaction.withTenant(async (tx) => {
      const reg = await tx.registration.findFirstOrThrow({
        where: { id: participant.registrationId, organizationId: participant.organizationId },
        select: { personId: true },
      });
      await this.erasePerson(tx, participant.organizationId, reg.personId, null, 'participant');
    });
  }

  /** Staff erasing a person on request (or for another lawful reason). */
  eraseRegistration(eventId: string, registrationId: string): Promise<void> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const reg = await tx.registration.findFirst({
        where: { id: registrationId, eventId, organizationId: tenant.organizationId },
        select: { personId: true },
      });
      if (!reg) {
        throw AppException.notFound('not_found', 'Registration not found.');
      }
      await this.erasePerson(tx, tenant.organizationId, reg.personId, tenant.userId || null, 'staff');
    });
  }

  getRetention(): Promise<RetentionSettings> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const settings = await tx.workspaceSettings.findUnique({
        where: { organizationId: tenant.organizationId },
        select: { retentionMonths: true },
      });
      return { retentionMonths: settings?.retentionMonths ?? null };
    });
  }

  setRetention(input: RetentionSettings): Promise<RetentionSettings> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      await tx.workspaceSettings.upsert({
        where: { organizationId: tenant.organizationId },
        create: { organizationId: tenant.organizationId, retentionMonths: input.retentionMonths },
        update: { retentionMonths: input.retentionMonths },
      });
      await writeAudit(tx, {
        organizationId: tenant.organizationId,
        actorUserId: tenant.userId || null,
        action: 'retention.configured',
        targetType: 'workspace',
        metadata: { retentionMonths: input.retentionMonths },
      });
      return input;
    });
  }

  /** Erases everyone whose events all ended before the cutoff. A dry run only counts them. */
  purgeExpired(dryRun: boolean): Promise<PurgeResult> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const settings = await tx.workspaceSettings.findUnique({
        where: { organizationId: tenant.organizationId },
        select: { retentionMonths: true },
      });
      if (!settings?.retentionMonths) {
        throw AppException.unprocessable('retention_not_configured', 'Set a retention period first.');
      }

      const cutoff = retentionCutoff(new Date(), settings.retentionMonths);
      const people = await tx.person.findMany({
        where: {
          organizationId: tenant.organizationId,
          erasedAt: null,
          registrations: { some: {}, none: { event: { endsAt: { gt: cutoff } } } },
        },
        select: { id: true },
      });

      if (!dryRun) {
        for (const person of people) {
          await this.erasePerson(tx, tenant.organizationId, person.id, tenant.userId || null, 'retention');
        }
      }

      return {
        dryRun,
        retentionMonths: settings.retentionMonths,
        cutoff: cutoff.toISOString(),
        eligible: people.length,
        erased: dryRun ? 0 : people.length,
      };
    });
  }

  private async erasePerson(
    tx: TenantPrismaClient,
    organizationId: string,
    personId: string,
    actorUserId: string | null,
    reason: 'participant' | 'staff' | 'retention',
  ): Promise<void> {
    const registrations = await tx.registration.findMany({
      where: { organizationId, personId },
      select: { id: true, status: true },
    });
    const ids = registrations.map((r) => r.id);

    await tx.person.update({
      where: { id: personId },
      data: { ...anonymisedPerson(personId), erasedAt: new Date() },
    });

    for (const registration of registrations) {
      await tx.registration.update({
        where: { id: registration.id },
        data: {
          answers: {},
          decisionNote: null,
          accessTokenHash: deadCredentialHash(),
          idempotencyKey: null,
          ...(['PENDING', 'CONFIRMED'].includes(registration.status) && { status: 'CANCELLED' }),
        },
      });
    }

    await tx.consentRecord.updateMany({ where: { organizationId, registrationId: { in: ids } }, data: { ipAddress: null } });
    await tx.participantProfile.deleteMany({ where: { organizationId, registrationId: { in: ids } } });
    await tx.innovation.deleteMany({ where: { organizationId, ownerRegistrationId: { in: ids } } });
    await tx.meeting.updateMany({
      where: { organizationId, OR: [{ proposerRegistrationId: { in: ids } }, { inviteeRegistrationId: { in: ids } }] },
      data: { message: null, location: null },
    });
    await tx.introductionRequest.updateMany({
      where: { organizationId, requesterRegistrationId: { in: ids } },
      data: { reason: '[erased]', helpOffered: '[erased]' },
    });

    await writeAudit(tx, {
      organizationId,
      actorUserId,
      action: 'person.erased',
      targetType: 'person',
      targetId: personId,
      metadata: { reason, registrations: ids.length },
    });
  }
}
