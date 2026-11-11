import { describe, expect, it } from 'vitest';
import { composeParticipantCredential, parseParticipantCredential } from '@event-platform/shared';

const ORG = '11111111-1111-4111-8111-111111111111';
const REG = '22222222-2222-4222-8222-222222222222';

describe('participant credential', () => {
  it('round-trips', () => {
    const token = 'abcdefghijklmnopqrstuvwxyz012345';

    expect(parseParticipantCredential(composeParticipantCredential(ORG, REG, token))).toEqual({
      organizationId: ORG,
      registrationId: REG,
      token,
    });
  });

  it.each(['', 'a.b.c', `${ORG}.${REG}`, `${ORG}.${REG}.short`, `${ORG}.not-a-uuid.abcdefghijklmnopqrstuvwxyz`])('rejects %j', (value) => {
    expect(parseParticipantCredential(value)).toBeNull();
  });

  it('rejects an extra segment, so a token containing dots cannot smuggle ids', () => {
    expect(parseParticipantCredential(`${ORG}.${REG}.abcdefghijklmnopqrstuvwxyz.extra`)).toBeNull();
  });
});
