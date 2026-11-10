import { describe, expect, it, vi } from 'vitest';
import { timeStep, totpAt } from '../../common/utils/totp';
import { MfaService } from './mfa.service';

interface FakeUser {
  id: string;
  email: string;
  mfaSecretEnc: string | null;
  mfaEnabledAt: Date | null;
  mfaLastStep: bigint | null;
  mfaRecoveryHashes: string[];
  mfaFailedAttempts: number;
  mfaLockedUntil: Date | null;
}

function setup(seed: Partial<FakeUser> = {}) {
  const user: FakeUser = {
    id: 'user-1',
    email: 'ada@example.test',
    mfaSecretEnc: null,
    mfaEnabledAt: null,
    mfaLastStep: null,
    mfaRecoveryHashes: [],
    mfaFailedAttempts: 0,
    mfaLockedUntil: null,
    ...seed,
  };

  const prisma = {
    user: {
      findUniqueOrThrow: vi.fn(async () => ({ ...user })),
      update: vi.fn(async ({ data }: { data: Partial<FakeUser> }) => {
        Object.assign(user, data);
        return { ...user };
      }),
    },
  };

  const audit = { record: vi.fn(async () => undefined) };
  const config = { get: () => 'a-test-application-secret-of-enough-length' };
  const service = new MfaService(
    prisma as never,
    config as never,
    audit as never,
  );

  return { service, user, prisma, audit };
}

describe('MFA enrolment', () => {
  it('stores an encrypted secret and never returns it from the database', async () => {
    const { service, user } = setup();

    const result = await service.setup('user-1');

    expect(result.otpauthUrl).toContain('otpauth://totp/');
    expect(result.secret).toMatch(/^[A-Z2-7]+$/);
    expect(user.mfaSecretEnc).not.toBe(result.secret);
    expect(user.mfaEnabledAt).toBeNull();
  });

  it('turns on with a valid code, stores hashed recovery codes and audits it', async () => {
    const { service, user, audit } = setup();
    const { secret } = await service.setup('user-1');

    const result = await service.enable(
      'user-1',
      totpAt(secret, timeStep(new Date())),
    );

    expect(result.recoveryCodes).toHaveLength(8);
    expect(user.mfaEnabledAt).not.toBeNull();
    expect(user.mfaRecoveryHashes).toHaveLength(8);
    expect(user.mfaRecoveryHashes).not.toContain(result.recoveryCodes[0]);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ targetId: 'user-1' }),
    );
  });

  it('refuses to enable with a wrong code', async () => {
    const { service } = setup();
    await service.setup('user-1');

    await expect(service.enable('user-1', 'AAAAA-AAAAA')).rejects.toMatchObject({
      code: 'mfa_invalid',
    });
  });
});

describe('MFA sign-in', () => {
  async function enabled() {
    const harness = setup();
    const { secret } = await harness.service.setup('user-1');
    const codes = (
      await harness.service.enable('user-1', totpAt(secret, timeStep(new Date())))
    ).recoveryCodes;
    return { ...harness, secret, codes };
  }

  it('requires a code only when MFA is on', async () => {
    const { service } = setup();
    await expect(service.assertLoginAllowed('user-1', undefined)).resolves.toBeUndefined();

    const on = await enabled();
    await expect(on.service.assertLoginAllowed('user-1', undefined)).rejects.toMatchObject({
      code: 'mfa_required',
    });
  });

  it('accepts the next time step and refuses a replay of the step used to enable', async () => {
    const { service, secret } = await enabled();
    const used = totpAt(secret, timeStep(new Date()));

    await expect(service.assertLoginAllowed('user-1', used)).rejects.toMatchObject({
      code: 'mfa_invalid',
    });
    await expect(
      service.assertLoginAllowed('user-1', totpAt(secret, timeStep(new Date()) + 1)),
    ).resolves.toBeUndefined();
  });

  it('accepts each recovery code once and removes it', async () => {
    const { service, user, codes } = await enabled();

    await expect(service.assertLoginAllowed('user-1', codes[0])).resolves.toBeUndefined();
    expect(user.mfaRecoveryHashes).toHaveLength(7);
    await expect(service.assertLoginAllowed('user-1', codes[0])).rejects.toMatchObject({
      code: 'mfa_invalid',
    });
  });

  it('locks the account after repeated wrong codes', async () => {
    const { service } = await enabled();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(
        service.assertLoginAllowed('user-1', 'AAAAA-AAAAA'),
      ).rejects.toMatchObject({ code: 'mfa_invalid' });
    }

    await expect(
      service.assertLoginAllowed('user-1', 'AAAAA-AAAAA'),
    ).rejects.toMatchObject({ code: 'mfa_locked' });
  });
});

describe('MFA disable', () => {
  it('turns off only after a valid code and clears the stored state', async () => {
    const { service, user, audit } = setup();
    const { secret } = await service.setup('user-1');
    const { recoveryCodes } = await service.enable(
      'user-1',
      totpAt(secret, timeStep(new Date())),
    );

    await service.disable('user-1', recoveryCodes[0]);

    expect(user.mfaEnabledAt).toBeNull();
    expect(user.mfaSecretEnc).toBeNull();
    expect(user.mfaRecoveryHashes).toEqual([]);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ targetId: 'user-1' }),
    );
  });
});
