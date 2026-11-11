import { describe, expect, it, vi } from 'vitest';
import { RegistrationsRetentionService } from './registrations-retention.service';

function build(retentionMonths: number | null, expired: string[]) {
  const tx = {
    workspaceSettings: { findUnique: vi.fn().mockResolvedValue({ retentionMonths }) },
  };
  const tenantTransaction = {
    withTenant: (cb: (tx: unknown, t: { organizationId: string }) => unknown) =>
      cb(tx, { organizationId: 'org-1' }),
  };
  const repository = {
    findExpiredPersonIds: vi.fn().mockResolvedValue(expired),
    erasePersonData: vi.fn().mockResolvedValue(1),
  };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const service = new RegistrationsRetentionService(
    tenantTransaction as never,
    repository as never,
    audit as never,
  );
  return { service, repository, audit };
}

describe('RegistrationsRetentionService', () => {
  it('does nothing when no retention period is configured', async () => {
    const { service, repository } = build(null, ['p1']);
    const result = await service.purgeExpired(false);
    expect(result).toMatchObject({ retentionMonths: null, people: 0 });
    expect(repository.erasePersonData).not.toHaveBeenCalled();
  });

  it('counts but never erases on a dry run', async () => {
    const { service, repository, audit } = build(12, ['p1', 'p2']);
    const result = await service.purgeExpired(true);
    expect(result.people).toBe(2);
    expect(repository.erasePersonData).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('erases every expired person and audits the purge', async () => {
    const { service, repository, audit } = build(12, ['p1', 'p2']);
    const result = await service.purgeExpired(false);
    expect(result.people).toBe(2);
    expect(repository.erasePersonData).toHaveBeenCalledTimes(2);
    expect(audit.record).toHaveBeenCalledOnce();
  });
});
