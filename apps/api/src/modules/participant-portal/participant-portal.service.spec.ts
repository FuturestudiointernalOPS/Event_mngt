import { describe, expect, it, vi } from 'vitest';
import type { AuditService } from '../../common/audit/audit.service';
import { AppException } from '../../common/app-exception';
import type { ParticipantAccess } from '../../common/types/authenticated-user';
import type { TenantTransactionService } from '../../database/tenant-transaction.service';
import type { RegistrationsService } from '../registrations/registrations.service';
import { ParticipantPortalService } from './participant-portal.service';

const participant: ParticipantAccess = {
  organizationId: 'org-1',
  registrationId: 'reg-1',
  eventId: 'event-1',
  badgeReference: 'EP-ABC',
  badgeToken: 'secret-token-secret-token',
};

function harness(row: Record<string, unknown> | null) {
  const registration = { findFirst: vi.fn().mockResolvedValue(row), update: vi.fn().mockResolvedValue({}) };
  const badge = { updateMany: vi.fn().mockResolvedValue({ count: 1 }) };
  const tx = { registration, badge };
  const tenantTransaction = { withTenant: async (cb: (t: unknown) => Promise<unknown>) => cb(tx) } as unknown as TenantTransactionService;
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const registrations = { erase: vi.fn().mockResolvedValue(undefined) };
  const service = new ParticipantPortalService(
    tenantTransaction,
    registrations as unknown as RegistrationsService,
    audit as unknown as AuditService,
  );
  return { service, registration, badge, audit, registrations };
}

const eventRow = {
  name: 'Summit', slug: 'summit', timeZone: 'UTC', venueName: null, venueAddress: null,
  startsAt: new Date('2027-06-01T09:00:00Z'), endsAt: new Date('2027-06-01T17:00:00Z'),
  modules: [{ moduleKey: 'registration' }, { moduleKey: 'showcase' }],
};

describe('ParticipantPortalService', () => {
  it('shows the participant their own badge QR and only the modules the event enabled', async () => {
    const { service, registration } = harness({
      reference: 'EP-ABC', person: { firstName: 'Ada', lastName: 'L' }, category: null, checkIns: [], event: eventRow,
    });
    const overview = await service.overview(participant);

    expect(overview.badge.qrPayload).toBe('ep-badge:secret-token-secret-token');
    expect(overview.modules).toEqual(['registration', 'showcase']);
    expect(overview.checkedIn).toBe(false);
    // Bound to the one registration the credential proved, inside its organisation.
    expect(registration.findFirst.mock.calls[0]?.[0].where).toEqual({ id: 'reg-1', organizationId: 'org-1' });
  });

  it('withdraws: cancels the registration, revokes the badge and audits it', async () => {
    const { service, registration, badge, audit } = harness({ status: 'APPROVED', checkIns: [] });
    await service.withdraw(participant);

    expect(registration.update.mock.calls[0]?.[0].data.status).toBe('CANCELLED');
    expect(badge.updateMany.mock.calls[0]?.[0].data.status).toBe('REVOKED');
    expect(audit.record).toHaveBeenCalledTimes(1);
  });

  it('refuses to withdraw after check-in and changes nothing', async () => {
    const { service, registration, badge } = harness({ status: 'APPROVED', checkIns: [{ id: 'c1' }] });
    const error = await service.withdraw(participant).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AppException);
    expect((error as AppException).code).toBe('already_checked_in');
    expect(registration.update).not.toHaveBeenCalled();
    expect(badge.updateMany).not.toHaveBeenCalled();
  });

  it('erases through the registrations service for the proven registration only', async () => {
    const { service, registrations } = harness(null);
    await service.erase(participant);

    expect(registrations.erase).toHaveBeenCalledWith('event-1', 'reg-1');
  });
});
