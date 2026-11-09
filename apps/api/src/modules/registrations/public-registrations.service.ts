import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type {
  Locale,
  PublicRegistrationResult,
  SubmitRegistrationRequest,
} from '@event-platform/shared';
import { writeAudit } from '../../common/audit/audit';
import { AppException } from '../../common/app-exception';
import { composeAccessToken, newAccessSecret } from '../../common/utils/badge';
import { hashOpaqueToken } from '../../common/utils/tokens';
import type { Env } from '../../config/env.validation';
import { RegistrationStatus } from '../../database/prisma-client';
import { PrismaService } from '../../database/prisma.service';
import { TenantTransactionService } from '../../database/tenant-transaction.service';
import type { TenantPrismaClient } from '../../database/tenant-transaction.service';
import { EMAIL_PORT } from '../../integrations/email/email.port';
import type { EmailPort } from '../../integrations/email/email.port';
import { findPublicEvent, registrationSettings } from './public-registration-context';
import { composeRegistrationEmail } from './registration-emails';
import {
  assertCapacity,
  assertConsent,
  assertRegistrationOpen,
  initialStatus,
  validateAnswers,
  type FormField,
} from './registration.rules';

const COUNTED = [RegistrationStatus.PENDING, RegistrationStatus.CONFIRMED];

/**
 * Public registration: no account, no session. The organisation comes from the public
 * event slug (visibility enforced by the database), and every query that follows runs
 * inside that organisation's scope with explicit predicates.
 */
@Injectable()
export class PublicRegistrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantTransaction: TenantTransactionService,
    private readonly config: ConfigService<Env, true>,
    @Inject(EMAIL_PORT) private readonly email: EmailPort,
  ) {}

  async submit(
    eventSlug: string,
    input: SubmitRegistrationRequest,
    idempotencyKey: string | null,
    ipAddress: string | null,
  ): Promise<PublicRegistrationResult> {
    const event = await findPublicEvent(this.prisma, eventSlug);
    assertRegistrationOpen(event, new Date());

    const outcome = await this.tenantTransaction.withOrganization(
      event.organizationId,
      null,
      async (tx) => {
        const settings = await registrationSettings(tx, event.id);

        if (idempotencyKey) {
          const replay = await tx.registration.findFirst({
            where: { eventId: event.id, idempotencyKey },
            select: { id: true, status: true },
          });
          if (replay) {
            return { result: { registrationId: replay.id, status: replay.status, accessToken: null, replayed: true } };
          }
        }

        const category = await tx.participantCategory.findFirst({
          where: { eventId: event.id, key: input.categoryKey, isActive: true },
        });
        if (!category) {
          throw AppException.badRequest('invalid_category', 'This category is not available.');
        }

        // Serialise concurrent registrations for one category so capacity cannot be exceeded.
        await tx.$queryRaw`SELECT id FROM participant_categories WHERE id = ${category.id}::uuid FOR UPDATE`;
        assertCapacity(
          category,
          await tx.registration.count({
            where: { categoryId: category.id, status: { in: COUNTED } },
          }),
        );

        const fieldRows = await tx.registrationField.findMany({ where: { eventId: event.id } });
        const fields: FormField[] = fieldRows.map((f) => ({
          key: f.key,
          label: f.label,
          type: f.type,
          required: f.required,
          options: (f.options as string[] | null) ?? null,
          categoryId: f.categoryId,
        }));
        const answers = validateAnswers(fields, category.id, input.answers);
        assertConsent(settings.requiresConsent, event.consentText, input.consent);

        const person = await tx.person.upsert({
          where: { organizationId_email: { organizationId: event.organizationId, email: input.email } },
          create: {
            organizationId: event.organizationId,
            email: input.email,
            firstName: input.firstName,
            lastName: input.lastName,
            phone: input.phone ?? null,
          },
          update: { firstName: input.firstName, lastName: input.lastName, phone: input.phone ?? null },
        });

        const existing = await tx.registration.findFirst({
          where: { eventId: event.id, personId: person.id },
          select: { id: true },
        });
        if (existing) {
          throw AppException.conflict('already_registered', 'This email address is already registered for this event.');
        }

        const registrationId = randomUUID();
        const secret = newAccessSecret();
        const status = initialStatus({
          approvalMode: settings.approvalMode,
          categoryRequiresApproval: category.requiresApproval,
        });

        await tx.registration.create({
          data: {
            id: registrationId,
            organizationId: event.organizationId,
            eventId: event.id,
            personId: person.id,
            categoryId: category.id,
            status,
            answers,
            accessTokenHash: hashOpaqueToken(secret),
            idempotencyKey,
            ...(status === 'CONFIRMED' && { decidedAt: new Date() }),
          },
        });

        if (event.consentText) {
          await tx.consentRecord.create({
            data: {
              organizationId: event.organizationId,
              registrationId,
              purpose: 'registration',
              policyVersion: event.consentVersion,
              granted: input.consent,
              ipAddress,
            },
          });
        }

        await writeAudit(tx, {
          organizationId: event.organizationId,
          action: 'registration.submitted',
          targetType: 'registration',
          targetId: registrationId,
          metadata: { status },
        });

        const locale = await this.localeOf(tx, event.organizationId);
        const accessToken = composeAccessToken(event.organizationId, registrationId, secret);

        return {
          result: { registrationId, status, accessToken, replayed: false },
          mail: { status, locale },
        };
      },
    );

    if (outcome.mail && outcome.result.accessToken) {
      const message = composeRegistrationEmail(outcome.mail.status === 'CONFIRMED' ? 'confirmed' : 'pending', {
        locale: outcome.mail.locale,
        eventName: event.name,
        firstName: input.firstName,
        portalUrl: `${this.config.get('WEB_APP_URL', { infer: true })}/participant?token=${outcome.result.accessToken}`,
      });
      await this.email.send({ to: input.email, subject: message.subject, text: message.text });
    }

    return outcome.result;
  }

  private async localeOf(tx: TenantPrismaClient, organizationId: string): Promise<Locale> {
    const settings = await tx.workspaceSettings.findUnique({
      where: { organizationId },
      select: { defaultLocale: true },
    });
    return settings?.defaultLocale === 'en' ? 'en' : 'fr';
  }
}
