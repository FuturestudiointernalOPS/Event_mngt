import type {
  PlatformOrganizationDetail,
  PlatformOrganizationOverview,
} from '@event-platform/shared';
import type {
  PlatformMemberCounts,
  PlatformOverviewRow,
} from './platform-organizations.repository';

export function toPlatformOrganizationOverview(
  row: PlatformOverviewRow,
): PlatformOrganizationOverview {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    status: row.status,
    capabilityCount: row._count.capabilities,
    memberCount: row._count.members,
    eventCount: row._count.events,
    registrationCount: row._count.registrations,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toPlatformOrganizationDetail(
  row: PlatformOverviewRow,
  members: PlatformMemberCounts,
): PlatformOrganizationDetail {
  return {
    ...toPlatformOrganizationOverview(row),
    members,
  };
}
