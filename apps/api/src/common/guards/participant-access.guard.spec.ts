import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { composeParticipantCredential } from '@event-platform/shared';
import { describe, expect, it, vi } from 'vitest';
import { hashBadgeToken } from '../../modules/badges/badge.tokens';
import type { TenantTransactionService } from '../../database/tenant-transaction.service';
import { AppException } from '../app-exception';
import { ParticipantScoped } from '../decorators/participant-scoped.decorator';
import { PARTICIPANT_CREDENTIAL_HEADER, ParticipantAccessGuard } from './participant-access.guard';

const ORG = '11111111-1111-4111-8111-111111111111';
const REG = '22222222-2222-4222-8222-222222222222';
const TOKEN = 'abcdefghijklmnopqrstuvwxyz012345';

@ParticipantScoped()
class Scoped {
  handler(): void {}
}
class Open {
  handler(): void {}
}

function setup(found: unknown) {
  const findFirst = vi.fn().mockResolvedValue(found);
  const scope = vi.fn(async (organizationId: string, cb: (tx: unknown) => Promise<unknown>) =>
    cb({ badge: { findFirst } }),
  );
  const guard = new ParticipantAccessGuard(new Reflector(), { withOrganizationScope: scope } as unknown as TenantTransactionService);
  const run = async (target: object, header?: string) => {
    const request: Record<string, unknown> = { headers: header ? { [PARTICIPANT_CREDENTIAL_HEADER]: header } : {} };
    const context = {
      getHandler: () => (target as { handler: () => void }).handler,
      getClass: () => target.constructor,
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    const result = await guard.canActivate(context);
    return { result, request };
  };
  return { run, findFirst, scope };
}

const credential = composeParticipantCredential(ORG, REG, TOKEN);

describe('ParticipantAccessGuard', () => {
  it('lets routes that are not participant-scoped through untouched', async () => {
    const { run, scope } = setup(null);

    expect((await run(new Open())).result).toBe(true);
    expect(scope).not.toHaveBeenCalled();
  });

  it('proves access by the secret inside the organisation scope and attaches the participant', async () => {
    const { run, findFirst, scope } = setup({ eventId: 'e1', registration: { reference: 'EP-1' } });
    const { request } = await run(new Scoped(), credential);

    expect(scope).toHaveBeenCalledWith(ORG, expect.any(Function));
    expect(findFirst.mock.calls[0]?.[0].where).toMatchObject({
      organizationId: ORG,
      registrationId: REG,
      tokenHash: hashBadgeToken(TOKEN),
      status: 'ISSUED',
      registration: { status: 'APPROVED' },
    });
    expect(request.participant).toEqual({ organizationId: ORG, registrationId: REG, eventId: 'e1', badgeReference: 'EP-1', badgeToken: TOKEN });
  });

  it('refuses a forged or stale credential with the same error as a malformed one', async () => {
    const stale = setup(null);
    const codes: string[] = [];
    for (const attempt of [() => stale.run(new Scoped(), credential), () => stale.run(new Scoped(), 'garbage'), () => stale.run(new Scoped())]) {
      await attempt().catch((error: unknown) => codes.push(error instanceof AppException ? error.code : 'other'));
    }

    expect(codes).toEqual(['participant_credential_invalid', 'participant_credential_invalid', 'participant_credential_invalid']);
  });

  it('does not even query the database for a malformed credential', async () => {
    const { run, scope } = setup({ eventId: 'e1', registration: { reference: 'EP-1' } });
    await run(new Scoped(), `${ORG}.${REG}.short`).catch(() => undefined);

    expect(scope).not.toHaveBeenCalled();
  });
});
