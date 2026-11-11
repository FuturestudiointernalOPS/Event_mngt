import { describe, expect, it, vi } from 'vitest';
import type { TenantContext } from '../../database/tenant-context.service';
import { ReportExportsService } from './report-exports.service';
import type { ReportExportMetaRow } from './report-exports.repository';

const CONTEXT: TenantContext = {
  organizationId: 'org-1',
  userId: 'user-1',
  membershipId: 'member-1',
  permissions: [],
};

const ROW: ReportExportMetaRow = {
  id: 'export-1',
  organizationId: 'org-1',
  eventId: 'event-1',
  requestedByUserId: 'user-1',
  kind: 'REGISTRATIONS',
  format: 'CSV',
  status: 'PENDING',
  fileName: 'registrations-event-20261110-120000.csv',
  contentType: 'text/csv; charset=utf-8',
  rowCount: 0,
  byteSize: 0,
  truncated: false,
  error: null,
  createdAt: new Date('2026-11-10T12:00:00.000Z'),
  startedAt: null,
  completedAt: null,
  expiresAt: new Date('2026-11-17T12:00:00.000Z'),
};

function setup() {
  const tenantTransaction = {
    withTenant: vi.fn(
      async (callback: (tx: unknown, tenant: TenantContext) => unknown) =>
        callback({}, CONTEXT),
    ),
  };
  const tenantContext = { getOrThrow: vi.fn(() => CONTEXT) };
  const repository = {
    findEvent: vi.fn(async () => ({
      id: 'event-1',
      name: 'Innovation Village',
      slug: 'innovation-village',
    })),
    create: vi.fn(async () => ROW),
  };
  const queue = { enqueue: vi.fn(async () => true) };
  const worker = { enqueue: vi.fn() };
  const audit = { record: vi.fn(async () => undefined) };

  const service = new ReportExportsService(
    tenantTransaction as never,
    tenantContext as never,
    repository as never,
    queue as never,
    worker as never,
    audit as never,
  );

  return { service, queue, worker };
}

describe('report export scheduling', () => {
  it('enqueues a durable job instead of generating in-process', async () => {
    const { service, queue, worker } = setup();

    await service.create('event-1', { kind: 'REGISTRATIONS', format: 'CSV' });

    expect(queue.enqueue).toHaveBeenCalledWith('export-1', CONTEXT);
    expect(worker.enqueue).not.toHaveBeenCalled();
  });

  it('falls back to in-process generation when Redis is not configured', async () => {
    const { service, queue, worker } = setup();
    queue.enqueue.mockResolvedValue(false as never);

    await service.create('event-1', { kind: 'REGISTRATIONS', format: 'CSV' });

    expect(worker.enqueue).toHaveBeenCalledWith('export-1', CONTEXT);
  });

  it('falls back when the queue write fails', async () => {
    const { service, queue, worker } = setup();
    queue.enqueue.mockRejectedValue(new Error('redis down') as never);

    await service.create('event-1', { kind: 'REGISTRATIONS', format: 'CSV' });

    expect(worker.enqueue).toHaveBeenCalledWith('export-1', CONTEXT);
  });
});
