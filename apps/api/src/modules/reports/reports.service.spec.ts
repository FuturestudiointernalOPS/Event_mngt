import { describe, expect, it, vi } from 'vitest';
import type { TenantContext } from '../../database/tenant-context.service';
import { ReportsService } from './reports.service';

const CONTEXT: TenantContext = {
  organizationId: 'org-1',
  userId: 'user-1',
  membershipId: 'member-1',
  permissions: [],
};

function service() {
  const tx = {};
  const tenantTransaction = {
    withTenant: vi.fn(
      async (
        callback: (tx: unknown, tenant: TenantContext) => unknown,
      ) => callback(tx, CONTEXT),
    ),
  };
  const repository = {
    findEvent: vi.fn(),
    statusCounts: vi.fn(),
    sourceCounts: vi.fn(),
    categoryCounts: vi.fn(),
    listCategories: vi.fn(),
    participantStats: vi.fn(),
    profileCounts: vi.fn(),
    innovationCounts: vi.fn(),
    badgeCounts: vi.fn(),
    submittedSince: vi.fn(),
    timeline: vi.fn(),
  };
  const portfolio = {
    eventsForOrganization: vi.fn(),
    organizationStatusCounts: vi.fn(),
    findEventLocation: vi.fn(),
    editionFamily: vi.fn(),
    eventStatusCounts: vi.fn(),
  };
  const reports = new ReportsService(
    tenantTransaction as never,
    repository as never,
    portfolio as never,
  );

  return { reports, repository, portfolio };
}

describe('event summary', () => {
  it('composes every block from one tenant transaction', async () => {
    const { reports, repository } = service();
    repository.findEvent.mockResolvedValue({
      id: 'event-1',
      name: 'Innovation Village',
      slug: 'village-2026',
      status: 'PUBLISHED',
      startsAt: new Date('2026-11-01T00:00:00.000Z'),
      endsAt: new Date('2026-11-03T00:00:00.000Z'),
    });
    repository.statusCounts.mockResolvedValue([
      { status: 'APPROVED', count: 4 },
      { status: 'REJECTED', count: 1 },
    ]);
    repository.sourceCounts.mockResolvedValue([{ source: 'PUBLIC', count: 5 }]);
    repository.categoryCounts.mockResolvedValue([{ categoryId: 'startup', count: 5 }]);
    repository.listCategories.mockResolvedValue([
      { id: 'startup', key: 'startup', name: 'Startup', capacity: 10 },
    ]);
    repository.participantStats.mockResolvedValue({
      total: 5,
      withOrganization: 2,
      countries: 1,
    });
    repository.profileCounts.mockResolvedValue([{ moderationStatus: 'APPROVED', count: 3 }]);
    repository.innovationCounts.mockResolvedValue([{ moderationStatus: 'PENDING', count: 2 }]);
    repository.badgeCounts.mockResolvedValue([{ status: 'ISSUED', count: 4 }]);
    repository.submittedSince.mockResolvedValue(5);
    repository.timeline.mockResolvedValue([]);

    const report = await reports.eventSummary('event-1');

    expect(report.registrations.total).toBe(5);
    expect(report.registrations.byStatus.APPROVED).toBe(4);
    expect(report.registrations.bySource).toEqual({
      PUBLIC: 5,
      STAFF: 0,
      IMPORT: 0,
    });
    expect(report.registrations.byCategory).toEqual([
      { key: 'startup', name: 'Startup', capacity: 10, count: 5 },
    ]);
    expect(report.registrations.approvalRate).toBe(0.8);
    expect(report.participants).toEqual({ total: 5, withOrganization: 2, countries: 1 });
    expect(report.showcase.profiles.APPROVED).toBe(3);
    expect(report.showcase.innovations.PENDING).toBe(2);
    expect(report.badges).toEqual({ issued: 4, revoked: 0 });
    expect(report.timeline).toHaveLength(30);
  });

  it('reports a missing event as not found', async () => {
    const { reports, repository } = service();
    repository.findEvent.mockResolvedValue(null);

    await expect(reports.eventSummary('other-tenant')).rejects.toMatchObject({
      code: 'not_found',
    });
  });
});

describe('edition comparison', () => {
  it('resolves an edition id to its root family', async () => {
    const { reports, portfolio } = service();
    portfolio.findEventLocation
      .mockResolvedValueOnce({
        id: 'edition-2',
        parentEventId: 'root-1',
        name: 'Village 2026',
        slug: 'village-2026',
      })
      .mockResolvedValueOnce({
        id: 'root-1',
        parentEventId: null,
        name: 'Village',
        slug: 'village',
      });
    portfolio.editionFamily.mockResolvedValue([
      {
        id: 'root-1',
        name: 'Village',
        slug: 'village',
        status: 'PUBLISHED',
        startsAt: new Date('2025-01-01T00:00:00.000Z'),
        parentEventId: null,
      },
      {
        id: 'edition-2',
        name: 'Village 2026',
        slug: 'village-2026',
        status: 'PUBLISHED',
        startsAt: new Date('2026-01-01T00:00:00.000Z'),
        parentEventId: 'root-1',
      },
    ]);
    portfolio.eventStatusCounts.mockResolvedValue([
      { eventId: 'edition-2', status: 'APPROVED', count: 7 },
    ]);

    const comparison = await reports.editionComparison('edition-2');

    expect(comparison.root).toEqual({ id: 'root-1', name: 'Village', slug: 'village' });
    expect(comparison.editions).toHaveLength(2);
    expect(comparison.editions[1]?.registrations.total).toBe(7);
  });

  it('reports a missing family as not found', async () => {
    const { reports, portfolio } = service();
    portfolio.findEventLocation.mockResolvedValue(null);

    await expect(reports.editionComparison('missing')).rejects.toMatchObject({
      code: 'not_found',
    });
  });
});
