import { describe, expect, it } from 'vitest';
import { AppException } from '../../common/app-exception';
import { attendance, harness } from './check-ins.harness';

describe('attendance reads', () => {
  it('paginates the list and keeps the newest-first order it is given', async () => {
    const rows = [
      attendance({ id: 'check-in-a' }),
      attendance({ id: 'check-in-b' }),
      attendance({ id: 'check-in-c' }),
    ];
    const { service, listCalls } = harness({ rows, total: 3 });

    const page = await service.list('event-1', { page: 2, pageSize: 1 });

    expect(listCalls).toEqual([{ skip: 1, take: 1 }]);
    expect(page).toMatchObject({ page: 2, pageSize: 1, total: 3 });
    expect(page.items.map((item) => item.id)).toEqual(['check-in-b']);
    expect(page.items[0].duplicate).toBe(false);
  });

  it('returns the event total', async () => {
    const { service } = harness({ total: 42 });

    await expect(service.summary('event-1')).resolves.toEqual({ total: 42 });
  });

  it('refuses reads when the module is disabled', async () => {
    const moduleError = AppException.unprocessable(
      'module_not_enabled',
      'The "checkin" module is not enabled for this event.',
    );
    const { service } = harness({ moduleError });

    await expect(
      service.list('event-1', { page: 1, pageSize: 20 }),
    ).rejects.toMatchObject({ code: 'module_not_enabled' });
    await expect(service.summary('event-1')).rejects.toMatchObject({
      code: 'module_not_enabled',
    });
  });

  it('reports an event from another tenant as not found', async () => {
    const { service } = harness({ event: null });

    await expect(
      service.list('event-1', { page: 1, pageSize: 20 }),
    ).rejects.toMatchObject({ code: 'not_found' });
    await expect(service.summary('event-1')).rejects.toMatchObject({
      code: 'not_found',
    });
  });
});
