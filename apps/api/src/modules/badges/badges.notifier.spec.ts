import type { ConfigService } from '@nestjs/config';
import { parseParticipantCredential } from '@event-platform/shared';
import { describe, expect, it } from 'vitest';
import type { Env } from '../../config/env.validation';
import type { EmailMessage } from '../../integrations/email/email.port';
import { BadgeNotifier, type IssuedBadgeNotice } from './badges.notifier';

const ORG = '11111111-1111-4111-8111-111111111111';
const REG = '22222222-2222-4222-8222-222222222222';
const TOKEN = 'abcdefghijklmnopqrstuvwxyz012345';
const config = { get: () => 'https://events.example.com/' } as unknown as ConfigService<Env, true>;

function notice(token: string | null): IssuedBadgeNotice {
  return {
    organizationId: ORG,
    badge: { id: 'b1', registrationId: REG, reference: 'EP-ABC', status: 'ISSUED', issuedAt: 'now', revokedAt: null, reissueCount: 0 },
    token,
    recipient: { email: 'ada@example.com', name: 'Ada' },
    event: { name: 'Summit', slug: 'summit' },
  };
}

describe('BadgeNotifier', () => {
  it('puts a participant-space link in the e-mail whose credential the guard can parse', async () => {
    const sent: EmailMessage[] = [];
    await new BadgeNotifier({ send: async (m) => void sent.push(m) }, config).notify(notice(TOKEN));

    const link = /(https:\/\/events\.example\.com\/participant\?credential=\S+)/.exec(sent[0]?.text ?? '')?.[1] ?? '';
    const credential = decodeURIComponent(new URL(link).searchParams.get('credential') ?? '');

    expect(link.startsWith('https://events.example.com/participant?')).toBe(true);
    expect(parseParticipantCredential(credential)).toEqual({ organizationId: ORG, registrationId: REG, token: TOKEN });
  });

  it('sends nothing when there is no raw token (an idempotent re-issue has none to show)', async () => {
    const sent: EmailMessage[] = [];
    await new BadgeNotifier({ send: async (m) => void sent.push(m) }, config).notify(notice(null));

    expect(sent).toHaveLength(0);
  });
});
