import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { TenantPrismaClient } from '../../database/tenant-transaction.service';
import type { ListPlatformOrganizationsQuery } from '@event-platform/shared';
import {
  Prisma,
  type MemberStatus,
  type OrganizationStatus,
  type UserStatus,
} from '../../database/prisma-client';

const OVERVIEW_SELECT = {
  id: true,
  slug: true,
  name: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      capabilities: true,
      members: true,
      events: true,
      registrations: true,
    },
  },
} as const satisfies Prisma.OrganizationSelect;

export type PlatformOverviewRow = Prisma.OrganizationGetPayload<{
  select: typeof OVERVIEW_SELECT;
}>;

export interface PlatformMemberCounts {
  total: number;
  active: number;
  invited: number;
  suspended: number;
}

export interface PlatformOwnerAccount {
  id: string;
  email: string;
  status: UserStatus;
  emailVerifiedAt: Date | null;
}

/**
 * Cross-tenant platform reads and status changes.
 *
 * Callers must be inside `withPlatformSupport` (overview/detail counts) or
 * `withPlatformAdmin` (status change). The organisation predicate is still explicit
 * wherever a single organisation is addressed.
 */
@Injectable()
export class PlatformOrganizationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findOwnerAccount(email: string): Promise<PlatformOwnerAccount | null> {
    // Identity table: not tenant-owned, selected by an address supplied by a platform
    // administrator.
    return this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, status: true, emailVerifiedAt: true },
    });
  }

  listOverview(
    tx: TenantPrismaClient,
    query: ListPlatformOrganizationsQuery,
  ): Promise<[PlatformOverviewRow[], number]> {
    const where: Prisma.OrganizationWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { slug: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return Promise.all([
      tx.organization.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { name: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: OVERVIEW_SELECT,
      }),
      tx.organization.count({ where }),
    ]);
  }

  findOverview(
    tx: TenantPrismaClient,
    organizationId: string,
  ): Promise<PlatformOverviewRow | null> {
    return tx.organization.findUnique({
      where: { id: organizationId },
      select: OVERVIEW_SELECT,
    });
  }

  findStatus(
    tx: TenantPrismaClient,
    organizationId: string,
  ): Promise<{ id: string; status: OrganizationStatus } | null> {
    return tx.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, status: true },
    });
  }

  async updateStatus(
    tx: TenantPrismaClient,
    organizationId: string,
    status: OrganizationStatus,
  ): Promise<number> {
    const result = await tx.organization.updateMany({
      where: { id: organizationId },
      data: { status },
    });

    return result.count;
  }

  memberStatusCounts(
    tx: TenantPrismaClient,
    organizationId: string,
  ): Promise<PlatformMemberCounts> {
    return tx.organizationMember
      .groupBy({
        by: ['status'],
        where: { organizationId },
        _count: { _all: true },
      })
      .then((rows) => {
        const counts: PlatformMemberCounts = {
          total: 0,
          active: 0,
          invited: 0,
          suspended: 0,
        };

        for (const row of rows) {
          counts.total += row._count._all;
          counts[statusField(row.status)] = row._count._all;
        }

        return counts;
      });
  }
}

function statusField(status: MemberStatus): 'active' | 'invited' | 'suspended' {
  switch (status) {
    case 'ACTIVE':
      return 'active';
    case 'INVITED':
      return 'invited';
    case 'SUSPENDED':
      return 'suspended';
  }
}
