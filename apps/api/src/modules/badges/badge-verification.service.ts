import { Injectable } from '@nestjs/common';
import {
  TenantTransactionService,
  type TenantPrismaClient,
} from '../../database/tenant-transaction.service';
import { hashBadgeToken } from './badge.tokens';
import { BadgesRepository, type BadgeVerification } from './badges.repository';

export type { BadgeVerification } from './badges.repository';

/**
 * Badge lookup for check-in (WP-15).
 *
 * Kept apart from issuance so the raw token is hashed in exactly one place and the
 * check-in module imports a focused service rather than the whole badge lifecycle.
 */
@Injectable()
export class BadgeVerificationService {
  constructor(
    private readonly tenantTransaction: TenantTransactionService,
    private readonly repository: BadgesRepository,
  ) {}

  /**
   * Resolve a scanned token inside one event. The raw value is hashed here and never
   * stored; a token from another event or organisation simply returns null.
   */
  verifyForEvent(input: {
    organizationId: string;
    eventId: string;
    token: string;
  }): Promise<BadgeVerification | null> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      if (tenant.organizationId !== input.organizationId) {
        return null;
      }

      return this.verifyForEventInTransaction(
        tx,
        input.organizationId,
        input.eventId,
        input.token,
      );
    });
  }

  /** Transactional half, so check-in keeps verification and attendance in one scope. */
  verifyForEventInTransaction(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
    token: string,
  ): Promise<BadgeVerification | null> {
    return this.repository.verifyForEvent(
      tx,
      organizationId,
      eventId,
      hashBadgeToken(token),
    );
  }

  /**
   * Staff check-in without a token.
   *
   * The badge token is never retrievable, so a member of staff working from the name
   * search resolves the badge through the registration instead of inventing one.
   */
  verifyRegistrationInTransaction(
    tx: TenantPrismaClient,
    organizationId: string,
    eventId: string,
    registrationId: string,
  ): Promise<BadgeVerification | null> {
    return this.repository.verifyForRegistration(
      tx,
      organizationId,
      eventId,
      registrationId,
    );
  }
}
