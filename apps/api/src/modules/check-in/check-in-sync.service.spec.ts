import { describe, expect, it } from 'vitest';
import {
  MAX_SYNC_SCANS,
  syncCheckInsRequestSchema,
} from '@event-platform/shared';
import { harness, onlineAttendance, scan } from './check-in-sync.harness';

describe('offline batch sync', () => {
  it('creates one attendance row per valid scan', async () => {
    const { service, state } = harness();

    const response = await service.sync('event-1', {
      scans: [
        scan('scan-1', 'token-1', '2026-11-10T09:00:00.000Z'),
        scan('scan-2', 'token-2', '2026-11-10T09:01:00.000Z'),
      ],
    });

    expect(state.created).toHaveLength(2);
    expect(response.results.map((result) => result.status)).toEqual([
      'created',
      'created',
    ]);
    expect(response.counts).toEqual({ created: 2, duplicate: 0, rejected: 0 });
    expect(state.audits).toHaveLength(2);
  });

  it('replays a batch without creating new rows', async () => {
    const { service, state } = harness();
    const batch = {
      scans: [scan('scan-1', 'token-1', '2026-11-10T09:00:00.000Z')],
    };

    const first = await service.sync('event-1', batch);
    const second = await service.sync('event-1', batch);

    expect(first.results[0].status).toBe('created');
    expect(second.results[0].status).toBe('duplicate');
    expect(state.created).toHaveLength(1);
  });

  it('processes the rest of a batch when one token is unknown', async () => {
    const { service, state } = harness();

    const response = await service.sync('event-1', {
      scans: [
        scan('scan-1', 'unknown', '2026-11-10T09:00:00.000Z'),
        scan('scan-2', 'token-1', '2026-11-10T09:01:00.000Z'),
      ],
    });

    expect(response.results[0]).toMatchObject({
      status: 'rejected',
      code: 'not_found',
    });
    expect(response.results[1].status).toBe('created');
    expect(state.created).toHaveLength(1);
  });

  it('keeps the earliest scan when one registration appears twice', async () => {
    const { service, state } = harness();

    const response = await service.sync('event-1', {
      scans: [
        scan('scan-late', 'token-1', '2026-11-10T06:30:00.000Z'),
        scan('scan-early', 'token-1', '2026-11-10T06:00:00.000Z'),
      ],
    });

    expect(response.results.map((result) => result.status)).toEqual([
      'created',
      'duplicate',
    ]);
    expect(state.created).toHaveLength(1);
    expect(state.created[0].scanId).toBe('scan-early');
    expect(state.created[0].scannedAt.toISOString()).toBe(
      '2026-11-10T06:00:00.000Z',
    );
  });

  it('reports an online attendance as duplicate without moving its timestamp', async () => {
    const { service, state } = harness();
    const original = onlineAttendance();
    state.byRegistration.set('registration-1', original);

    const response = await service.sync('event-1', {
      scans: [scan('scan-1', 'token-1', '2026-11-10T09:00:00.000Z')],
    });

    expect(response.results[0]).toMatchObject({
      status: 'duplicate',
      checkInId: 'check-in-online',
    });
    expect(state.created).toHaveLength(0);
    expect(original.scannedAt.toISOString()).toBe('2026-11-10T08:00:00.000Z');
  });

  it('refuses a batch above the cap before writing anything', () => {
    const scans = Array.from({ length: MAX_SYNC_SCANS + 1 }, (_, index) =>
      scan(`scan-${index}`, 'token-1', '2026-11-10T09:00:00.000Z'),
    );

    expect(() => syncCheckInsRequestSchema.parse({ scans })).toThrow();
  });

  it('rejects a revoked badge without failing the batch', async () => {
    const { service } = harness();

    const response = await service.sync('event-1', {
      scans: [
        scan('scan-1', 'revoked', '2026-11-10T09:00:00.000Z'),
        scan('scan-2', 'token-2', '2026-11-10T09:01:00.000Z'),
      ],
    });

    expect(response.results[0]).toMatchObject({
      status: 'rejected',
      code: 'badge_revoked',
    });
    expect(response.results[1].status).toBe('created');
  });

  it('does not let a replayed scan id overwrite the stored scan', async () => {
    const { service, state } = harness();

    await service.sync('event-1', {
      scans: [scan('scan-1', 'token-1', '2026-11-10T09:00:00.000Z')],
    });
    const replay = await service.sync('event-1', {
      scans: [scan('scan-1', 'token-2', '2026-11-10T09:00:00.000Z')],
    });

    expect(replay.results[0]).toMatchObject({
      status: 'duplicate',
      checkInId: 'check-in-1',
    });
    expect(state.created).toHaveLength(1);
    expect(state.created[0].registrationId).toBe('registration-1');
  });

  it('stores the receive time for a scan beyond the future skew', async () => {
    const { service, state } = harness();

    await service.sync('event-1', {
      scans: [scan('scan-1', 'token-1', '2099-01-01T00:00:00.000Z')],
    });

    expect(state.created[0].scannedAt).toBe(state.created[0].receivedAt);
  });

  it('refuses the whole batch when offline sync is disabled', async () => {
    const { service, state } = harness();
    state.settings = { allowOffline: false, maxClockSkewMinutes: 5 };

    await expect(
      service.sync('event-1', {
        scans: [scan('scan-1', 'token-1', '2026-11-10T09:00:00.000Z')],
      }),
    ).rejects.toMatchObject({ code: 'offline_disabled' });
    expect(state.created).toHaveLength(0);
  });
});
