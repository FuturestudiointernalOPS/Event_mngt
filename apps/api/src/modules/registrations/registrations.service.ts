import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  DecideRegistrationRequest,
  ListRegistrationsQuery,
  Locale,
  RegistrationDetail,
  RegistrationSummary,
} from '@event-platform/shared';
import { writeAudit } from '../../common/audit/audit';
import { AppException } from '../../common/app-exception';
import type { PaginatedResult } from '../../common/types/authenticated-user';
import type { Env } from '../../config/env.validation';
import { TenantTransactionService } from '../../database/tenant-transaction.service';
import { EMAIL_PORT } from '../../integrations/email/email.port';
import type { EmailPort } from '../../integrations/email/email.port';
import { rotateAccessToken } from './registration-access';
import { composeRegistrationEmail } from './registration-emails';
import { resolveDecision } from './registration.rules';
import { toRegistrationDetail, toRegistrationSummary } from './registrations.mapper';
import { RegistrationsRepository } from './registrations.repository';

/** Staff review of registrations: list, detail, decisions and portal-link resend. */
@Injectable()
export class RegistrationsService {
  constructor(
    private readonly tenantTransaction: TenantTransactionService,
    private readonly repository: RegistrationsRepository,
    private readonly config: ConfigService<Env, true>,
    @Inject(EMAIL_PORT) private readonly email: EmailPort,
  ) {}

  list(eventId: string, query: ListRegistrationsQuery): Promise<PaginatedResult<RegistrationSummary>> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const [rows, total] = await this.repository.list(tx, tenant.organizationId, eventId, query);
      return { items: rows.map(toRegistrationSummary), page: query.page, pageSize: query.pageSize, total };
    });
  }

  detail(eventId: string, id: string): Promise<RegistrationDetail> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const row = await this.repository.findDetail(tx, tenant.organizationId, eventId, id);
      if (!row) {
        throw AppException.notFound('not_found', 'Registration not found.');
      }
      return toRegistrationDetail(row, row.consents);
    });
  }

  async decide(
    eventId: string,
    id: string,
    input: DecideRegistrationRequest,
  ): Promise<RegistrationDetail> {
    const outcome = await this.tenantTransaction.withTenant(async (tx, tenant) => {
      const row = await this.repository.findDetail(tx, tenant.organizationId, eventId, id);
      if (!row) {
        throw AppException.notFound('not_found', 'Registration not found.');
      }

      const next = resolveDecision(input.decision, row.status);

      await tx.registration.update({
        where: { id },
        data: {
          status: next,
          decidedAt: new Date(),
          decidedByUserId: tenant.userId,
          decisionNote: input.note ?? null,
        },
      });

      // A confirmed participant gets a fresh portal link carrying their QR badge.
      const token =
        next === 'CONFIRMED' ? await rotateAccessToken(tx, tenant.organizationId, id) : null;

      await writeAudit(tx, {
        organizationId: tenant.organizationId,
        actorUserId: tenant.userId,
        action: `registration.${input.decision.toLowerCase()}`,
        targetType: 'registration',
        targetId: id,
        metadata: { from: row.status, to: next },
      });

      const context = await this.emailContext(tx, tenant.organizationId, eventId);
      const fresh = await this.repository.findDetail(tx, tenant.organizationId, eventId, id);

      return { token, context, fresh: fresh!, next, to: row.person.email, firstName: row.person.firstName };
    });

    await this.notify(outcome.next, outcome.to, outcome.firstName, outcome.context, outcome.token);

    return toRegistrationDetail(outcome.fresh, outcome.fresh.consents);
  }

  /** Issues a new portal link (invalidating the old one) and e-mails it. */
  async resendAccess(eventId: string, id: string): Promise<void> {
    const outcome = await this.tenantTransaction.withTenant(async (tx, tenant) => {
      const row = await this.repository.findDetail(tx, tenant.organizationId, eventId, id);
      if (!row) {
        throw AppException.notFound('not_found', 'Registration not found.');
      }
      if (row.status !== 'CONFIRMED' && row.status !== 'PENDING') {
        throw AppException.unprocessable('invalid_status', 'This registration is not active.');
      }
      const token = await rotateAccessToken(tx, tenant.organizationId, id);
      const context = await this.emailContext(tx, tenant.organizationId, eventId);
      return { token, context, status: row.status, to: row.person.email, firstName: row.person.firstName };
    });

    await this.notify(outcome.status, outcome.to, outcome.firstName, outcome.context, outcome.token);
  }

  private async emailContext(
    tx: import('../../database/tenant-transaction.service').TenantPrismaClient,
    organizationId: string,
    eventId: string,
  ): Promise<{ eventName: string; locale: Locale }> {
    const event = await tx.event.findFirstOrThrow({
      where: { id: eventId, organizationId },
      select: { name: true, organization: { select: { settings: { select: { defaultLocale: true } } } } },
    });
    const locale = event.organization.settings?.defaultLocale === 'en' ? 'en' : 'fr';
    return { eventName: event.name, locale };
  }

  private async notify(
    status: 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'CANCELLED',
    to: string,
    firstName: string,
    context: { eventName: string; locale: Locale },
    token: string | null,
  ): Promise<void> {
    const portalUrl = token
      ? `${this.config.get('WEB_APP_URL', { infer: true })}/participant?token=${token}`
      : '';
    const message = composeRegistrationEmail(status.toLowerCase() as 'pending', {
      locale: context.locale,
      eventName: context.eventName,
      firstName,
      portalUrl,
    });
    await this.email.send({ to, subject: message.subject, text: message.text });
  }
}
