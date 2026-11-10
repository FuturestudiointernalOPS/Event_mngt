import { describe, expect, it, vi } from 'vitest';
import type { TenantContext } from '../../database/tenant-context.service';
import { ReportExportWorker } from './report-export-worker.service';
import type {
  ReportExportsRepository,
  ReportExportMetaRow,
} from './report-exports.repository';

const CONTEXT: TenantContext = {
  organizationId: 'org-1',
  userId: 'user-1',
  membershipId: 'member-1',
  permissions: [],
};

function meta(overrides: Partial<ReportExportMetaRow> = {}): ReportExportMetaRow {
  return {
    id: 'export-1',
    organizationId: 'org-1',
    eventId: 'event-1',
    requestedByUserId: 'user-1',
    kind: 'REGISTRATIONS',
    format: 'CSV',
    status: 'PROCESSING',
    fileName: 'registrations-event-20261110-120000.csv',
    contentType: 'text/csv; charset=utf-8',
    rowCount: 0,
    byteSize: 0,
    truncated: false,
    error: null,
    createdAt: new Date('2026-11-10T12:00:00.000Z'),
    startedAt: new Date('2026-11-10T12:00:01.000Z'),
    completedAt: null,
    expiresAt: new Date('2026-11-17T12:00:00.000Z'),
    ...overrides,
  };
}

function setup() {
  const tx = {};
  const tenantTransaction = {
    withTenantContext: vi.fn(
      async (
        _context: TenantContext,
        callback: (tx: unknown, tenant: TenantContext) => unknown,
      ) => callback(tx, CONTEXT),
    ),
  };
  const repository = {
    claim: vi.fn(),
    findEvent: vi.fn(),
    registrationRows: vi.fn(),
    complete: vi.fn(),
    fail: vi.fn(),
  };
  const worker = new ReportExportWorker(
    tenantTransaction as never,
    repository as unknown as ReportExportsRepository,
  );

  return { worker, repository, tenantTransaction };
}

const ROWS = [
  {
    reference: 'EP-1',
    status: 'APPROVED' as const,
    source: 'PUBLIC' as const,
    submittedAt: new Date('2026-11-09T10:00:00.000Z'),
    decidedAt: null,
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.test',
    phone: null,
    organizationName: null,
    jobTitle: null,
    country: null,
    categoryKey: null,
    categoryName: null,
  },
];

describe('export worker', () => {
  it('does nothing when another worker already claimed the row', async () => {
    const { worker, repository } = setup();
    repository.claim.mockResolvedValue(null);

    await expect(worker.process('export-1', CONTEXT)).resolves.toBe(false);
    expect(repository.complete).not.toHaveBeenCalled();
    expect(repository.fail).not.toHaveBeenCalled();
  });

  it('renders the snapshot and marks the row completed', async () => {
    const { worker, repository } = setup();
    repository.claim.mockResolvedValue(meta());
    repository.findEvent.mockResolvedValue({
      id: 'event-1',
      name: 'Innovation Village',
      slug: 'innovation-village',
    });
    repository.registrationRows.mockResolvedValue(ROWS);
    repository.complete.mockResolvedValue(meta({ status: 'COMPLETED' }));

    await expect(worker.process('export-1', CONTEXT)).resolves.toBe(true);

    expect(repository.complete).toHaveBeenCalledWith(
      expect.anything(),
      'org-1',
      'export-1',
      expect.objectContaining({
        rowCount: 1,
        byteSize: expect.any(Number),
        truncated: false,
      }),
    );

    const data = repository.complete.mock.calls[0][3] as { content: Buffer };
    expect(data.content.toString('utf8')).toContain('EP-1');
  });

  it('records a failure without leaking the underlying error', async () => {
    const { worker, repository } = setup();
    repository.claim.mockResolvedValue(meta());
    repository.findEvent.mockResolvedValue({
      id: 'event-1',
      name: 'Innovation Village',
      slug: 'innovation-village',
    });
    repository.registrationRows.mockRejectedValue(
      new Error('relation "registrations" does not exist'),
    );
    repository.fail.mockResolvedValue(meta({ status: 'FAILED' }));

    await expect(worker.process('export-1', CONTEXT)).resolves.toBe(false);

    expect(repository.fail).toHaveBeenCalledWith(
      expect.anything(),
      'org-1',
      'export-1',
      'The export could not be generated.',
    );
  });
});
