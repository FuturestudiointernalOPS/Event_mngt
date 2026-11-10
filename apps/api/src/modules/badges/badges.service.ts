import { Inject, Injectable, Logger } from '@nestjs/common';
import type {
  Badge,
  IssuedBadge,
  ListBadgesQuery,
} from '@event-platform/shared';
import { AppException } from '../../common/app-exception';
import type { PaginatedResult } from '../../common/types/authenticated-user';
import {
  TenantTransactionService,
  type TenantPrismaClient,
} from '../../database/tenant-transaction.service';
import { RegistrationStatus } from '../../database/prisma-client';
import { EMAIL_PORT, type EmailPort } from '../../integrations/email/email.port';
import { badgeQrPayload, createBadgeToken } from './badge.tokens';
import { toBadge } from './badges.mapper';
import {
  BadgesRepository,
  type BadgeRegistration,
  type BadgeWithReference,
} from './badges.repository';

/** What the caller needs to send the confirmation once its transaction commits. */
export interface IssuedBadgeNotice {
  badge: Badge;
  token: string | null;
  recipient: { email: string; name: string };
  event: { name: string; slug: string };
}

/**
 * Badge issuance, reissue and revocation (WP-13).
 *
 * Issuance runs inside the caller's transaction so an approved registration cannot end
 * up without a badge. Email is sent afterwards, because a provider failure must never
 * roll back a badge that already exists.
 */
@Injectable()
export class BadgesService {
  private readonly logger = new Logger(BadgesService.name);

  constructor(
    private readonly tenantTransaction: TenantTransactionService,
    private readonly repository: BadgesRepository,
    @Inject(EMAIL_PORT) private readonly email: EmailPort,
  ) {}

  list(eventId: string, query: ListBadgesQuery): Promise<PaginatedResult<Badge>> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      await this.assertEvent(tx, tenant.organizationId, eventId);

      const [rows, total] = await this.repository.list(
        tx,
        tenant.organizationId,
        eventId,
        query.status,
        (query.page - 1) * query.pageSize,
        query.pageSize,
      );

      return {
        items: rows.map(toBadge),
        page: query.page,
        pageSize: query.pageSize,
        total,
      };
    });
  }

  getForRegistration(eventId: string, registrationId: string): Promise<Badge | null> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      await this.requireRegistration(
        tx,
        tenant.organizationId,
        eventId,
        registrationId,
      );

      const badge = await this.repository.findBadge(
        tx,
        tenant.organizationId,
        registrationId,
      );

      return badge ? toBadge(badge) : null;
    });
  }

  async reissue(eventId: string, registrationId: string): Promise<IssuedBadge> {
    const notice = await this.tenantTransaction.withTenant(async (tx, tenant) => {
      const registration = await this.requireRegistration(
        tx,
        tenant.organizationId,
        eventId,
        registrationId,
      );

      if (registration.status !== RegistrationStatus.APPROVED) {
        throw AppException.unprocessable(
          'invalid_status_transition',
          'Only an approved registration can receive a badge.',
        );
      }

      const existing = await this.repository.findBadge(
        tx,
        tenant.organizationId,
        registrationId,
      );

      if (!existing) {
        throw AppException.notFound('not_found', 'Badge not found.');
      }

      const { token, tokenHash } = createBadgeToken();
      const now = new Date();

      const updated = await this.repository.update(
        tx,
        tenant.organizationId,
        existing.id,
        {
          tokenHash,
          status: 'ISSUED',
          issuedAt: now,
          revokedAt: null,
          reissuedAt: now,
          reissueCount: { increment: 1 },
        },
      );

      return this.noticeFor(updated, token, registration);
    });

    await this.notifyIssued(notice);

    return { ...notice.badge, token: notice.token as string };
  }

  revoke(eventId: string, registrationId: string): Promise<Badge> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      await this.requireRegistration(tx, tenant.organizationId, eventId, registrationId);

      const existing = await this.repository.findBadge(
        tx,
        tenant.organizationId,
        registrationId,
      );

      if (!existing) {
        throw AppException.notFound('not_found', 'Badge not found.');
      }

      const updated = await this.repository.update(
        tx,
        tenant.organizationId,
        existing.id,
        { status: 'REVOKED', revokedAt: new Date() },
      );

      return toBadge(updated);
    });
  }

  /**
   * Called by registration submission and approval inside their transaction. Issuing an
   * existing badge is idempotent and returns no token, because the raw value is not
   * recoverable.
   */
  async issueForApproved(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
    registrationId: string,
  ): Promise<IssuedBadgeNotice> {
    const registration = await this.requireRegistration(
      tx,
      organizationId,
      eventId,
      registrationId,
    );

    if (registration.status !== RegistrationStatus.APPROVED) {
      throw AppException.unprocessable(
        'invalid_status_transition',
        'Only an approved registration can receive a badge.',
      );
    }

    const existing = await this.repository.findBadge(
      tx,
      organizationId,
      registrationId,
    );

    if (existing) {
      return this.noticeFor(existing, null, registration);
    }

    const { token, tokenHash } = createBadgeToken();
    const created = await this.repository.create(tx, {
      organizationId,
      eventId,
      registrationId,
      tokenHash,
    });

    return this.noticeFor(created, token, registration);
  }

  /** Sends the confirmation. A provider failure is logged, never thrown. */
  async notifyIssued(notice: IssuedBadgeNotice): Promise<void> {
    if (!notice.token) {
      return;
    }

    const lines = [
      `Hello ${notice.recipient.name},`,
      '',
      `Your registration ${notice.badge.reference} for ${notice.event.name} is approved.`,
      `Badge code: ${badgeQrPayload(notice.token)}`,
      '',
      'Show this code at the entrance. Reissuing your badge invalidates this one.',
    ];

    try {
      await this.email.send({
        to: notice.recipient.email,
        subject: `${notice.event.name} — your badge`,
        text: lines.join('\n'),
      });
    } catch (error) {
      this.logger.warn(
        `Badge email failed for registration ${notice.badge.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private noticeFor(
    row: BadgeWithReference,
    token: string | null,
    registration: BadgeRegistration,
  ): IssuedBadgeNotice {
    return {
      badge: toBadge(row),
      token,
      recipient: {
        email: registration.person.email,
        name: `${registration.person.firstName} ${registration.person.lastName}`.trim(),
      },
      event: registration.event,
    };
  }

  private async requireRegistration(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
    registrationId: string,
  ): Promise<BadgeRegistration> {
    const registration = await this.repository.findRegistration(
      tx,
      organizationId,
      eventId,
      registrationId,
    );

    if (!registration) {
      throw AppException.notFound('not_found', 'Registration not found.');
    }

    return registration;
  }

  private async assertEvent(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
  ): Promise<void> {
    const event = await this.repository.eventExists(tx, organizationId, eventId);

    if (!event) {
      throw AppException.notFound('not_found', 'Event not found.');
    }
  }
}
