import { describe, expect, it } from 'vitest';
import {
  composeAccessToken,
  newAccessSecret,
  parseAccessToken,
  signBadge,
  verifyBadge,
} from './badge';

const SECRET = 'a-test-signing-secret-that-is-long-enough';
const ORG = '11111111-1111-4111-8111-111111111111';
const REG = '22222222-2222-4222-8222-222222222222';

describe('badge codes', () => {
  it('verifies a code it signed', () => {
    expect(verifyBadge(SECRET, ORG, signBadge(SECRET, ORG, REG))).toEqual({ registrationId: REG });
  });

  it('rejects a code signed with another secret', () => {
    expect(verifyBadge(SECRET, ORG, signBadge('another-secret-another-secret-xx', ORG, REG))).toBeNull();
  });

  it('rejects a code replayed in another organisation', () => {
    const other = '33333333-3333-4333-8333-333333333333';
    expect(verifyBadge(SECRET, other, signBadge(SECRET, ORG, REG))).toBeNull();
  });

  it('rejects a code re-pointed at another registration', () => {
    const code = signBadge(SECRET, ORG, REG).replace(REG, '44444444-4444-4444-8444-444444444444');
    expect(verifyBadge(SECRET, ORG, code)).toBeNull();
  });

  it.each(['', 'garbage', 'EP1.only-two', 'XX1.a.b', `EP1.${REG}.`])(
    'rejects malformed input %j',
    (input) => {
      expect(verifyBadge(SECRET, ORG, input)).toBeNull();
    },
  );
});

describe('participant access tokens', () => {
  it('round-trips', () => {
    const secret = newAccessSecret();
    expect(parseAccessToken(composeAccessToken(ORG, REG, secret))).toEqual({
      organizationId: ORG,
      registrationId: REG,
      secret,
    });
  });

  it.each(['', 'a.b.c', `${ORG}.${REG}.short`, `${ORG}.${REG}`])('rejects %j', (token) => {
    expect(parseAccessToken(token)).toBeNull();
  });
});
