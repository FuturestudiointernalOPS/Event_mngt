import { Injectable } from '@nestjs/common';
import type { MembershipSummary } from '@event-platform/shared';
import { MemberStatus, OrganizationStatus } from '../../database/prisma-client';
import { TenantTransactionService } from '../../database/tenant-transaction.service';
import { toMembershipSummary } from './auth.mapper';

/**
 * The caller's own workspace memberships, used by sign-in and by "who am I".
 *
 * This runs in the user-scoped bootstrap transaction: it must work before any tenant
 * is known, and row-level security only exposes this account's own rows there. See
 * WP-01 and docs/03.
 */
@Injectable()
export class AccountMembershipsService {
  constructor(private readonly tenantTransaction: TenantTransactionService) {}

  async list(userId: string): Promise<MembershipSummary[]> {
    return this.tenantTransaction.withUserScope(userId, async (tx) => {
      const memberships = await tx.organizationMember.findMany({
        where: {
          userId,
          status: MemberStatus.ACTIVE,
          organization: { status: OrganizationStatus.ACTIVE },
        },
        orderBy: { createdAt: 'asc' },
        select: {
          capabilities: { select: { capabilityKey: true } },
          organization: {
            select: {
              id: true,
              slug: true,
              name: true,
              capabilities: { select: { capabilityKey: true } },
            },
          },
          role: {
            select: {
              key: true,
              permissions: { select: { permission: { select: { key: true } } } },
            },
          },
        },
      });

      return memberships.map(toMembershipSummary);
    });
  }
}
