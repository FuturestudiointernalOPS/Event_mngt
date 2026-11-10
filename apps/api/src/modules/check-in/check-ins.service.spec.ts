import { describe, expect, it } from 'vitest';
import { AppException } from '../../common/app-exception';
import { EventStatus } from '../../database/prisma-client';
import { attendance, BADGE, harness, INPUT } from './check-ins.harness';

describe('recording a scan', () => {
  it('records a valid badge once and returns the participant summary', async () => {
    const { service, created, audits, moduleCalls } = harness();

    const result = await service.record('event-1', INPUT);

    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      organizationId: 'org-1',
      eventId: 'event-1',
      registrationId: 'registration-1',
      source: 'ONLINE',
      scanId: null,
      checkedInByUserId: 'user-1',
    });
    expect(created[0].scannedAt.toISOString()).toBe(INPUT.scannedAt);
    expect(created[0].receivedAt).toBeInstanceOf(Date);
    expect(result).toMatchObject({
      registrationId: 'registration-1',
      reference: 'IV26-0001',
      participant: { displayName: 'Amina Dossou', category: 'Exhibitor' },
      duplicate: false,
    });
    expect(JSON.stringify(result)).not.toContain(INPUT.badgeToken);
    expect(JSON.stringify(created)).not.toContain(INPUT.badgeToken);
    expect(moduleCalls).toEqual(['checkin']);
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      action: 'checkin.recorded',
      targetType: 'check_in',
      targetId: result.id,
    });
  });

  it('returns the original row for a repeat scan and writes nothing', async () => {
    const original = attendance();
    const { service, created, audits } = harness({ existing: original });

    const result = await service.record('event-1', INPUT);

    expect(result.duplicate).toBe(true);
    expect(result.scannedAt).toBe(original.scannedAt.toISOString());
    expect(created).toHaveLength(0);
    expect(audits).toHaveLength(0);
  });

  it('answers a replayed device scan id with the stored row', async () => {
    const { service, created } = harness({
      existingForScan: attendance({ id: 'check-in-replayed' }),
    });

    const result = await service.record('event-1', {
      ...INPUT,
      scanId: '7d6c1c2f-1bd1-4a3f-9b2e-1f1d2b3c4d5e',
    });

    expect(result).toMatchObject({ id: 'check-in-replayed', duplicate: true });
    expect(created).toHaveLength(0);
  });

  it('reports a token from another event or tenant as not found', async () => {
    const { service, created, audits } = harness({ badge: null });

    await expect(service.record('event-1', INPUT)).rejects.toMatchObject({
      code: 'not_found',
    });
    expect(created).toHaveLength(0);
    expect(audits).toHaveLength(0);
  });

  it('refuses a revoked badge', async () => {
    const { service, created } = harness({
      badge: { ...BADGE, status: 'REVOKED' },
    });

    await expect(service.record('event-1', INPUT)).rejects.toMatchObject({
      code: 'badge_revoked',
    });
    expect(created).toHaveLength(0);
  });

  it('refuses a cancelled event', async () => {
    const { service, created } = harness({
      event: { id: 'event-1', status: EventStatus.CANCELLED },
    });

    await expect(service.record('event-1', INPUT)).rejects.toMatchObject({
      code: 'event_not_operational',
    });
    expect(created).toHaveLength(0);
  });

  it('accepts a late scan on a completed event', async () => {
    const { service, created } = harness({
      event: { id: 'event-1', status: EventStatus.COMPLETED },
    });

    await expect(service.record('event-1', INPUT)).resolves.toMatchObject({
      duplicate: false,
    });
    expect(created).toHaveLength(1);
  });

  it('refuses when the check-in module is disabled', async () => {
    const moduleError = AppException.unprocessable(
      'module_not_enabled',
      'The "checkin" module is not enabled for this event.',
    );
    const { service, created } = harness({ moduleError });

    await expect(service.record('event-1', INPUT)).rejects.toMatchObject({
      code: 'module_not_enabled',
    });
    expect(created).toHaveLength(0);
  });

  it('reports an event from another tenant as not found', async () => {
    const { service } = harness({ event: null });

    await expect(service.record('event-1', INPUT)).rejects.toMatchObject({
      code: 'not_found',
    });
  });

  it('reports a badge whose registration is gone as not found', async () => {
    const { service, created } = harness({ registration: null });

    await expect(service.record('event-1', INPUT)).rejects.toMatchObject({
      code: 'not_found',
    });
    expect(created).toHaveLength(0);
  });

  it('uses the row the insert race left behind as a duplicate', async () => {
    const { service, audits } = harness({
      raced: attendance({ id: 'check-in-winner' }),
    });

    const result = await service.record('event-1', INPUT);

    expect(result).toMatchObject({ id: 'check-in-winner', duplicate: true });
    expect(audits).toHaveLength(0);
  });
});
