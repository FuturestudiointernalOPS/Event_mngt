import { describe, expect, it, vi } from 'vitest';
import { AppException } from '../../common/app-exception';
import type { ParticipantAccess } from '../../common/types/authenticated-user';
import type { TenantTransactionService } from '../../database/tenant-transaction.service';
import type { IntroductionsService } from '../introductions/introductions.service';
import type { MeetingsService } from '../meetings/meetings.service';
import type { ParticipantProfilesService } from '../profiles/participant-profiles.service';
import { ParticipantNetworkingService } from './participant-networking.service';

const participant: ParticipantAccess = {
  organizationId: 'org-1', registrationId: 'reg-1', eventId: 'event-1', badgeReference: 'EP-1', badgeToken: 'x'.repeat(24),
};

function harness(ownProfile: { id: string } | null) {
  const findFirst = vi.fn().mockResolvedValue(ownProfile);
  const tenantTransaction = { withTenant: async (cb: (t: unknown) => Promise<unknown>) => cb({ participantProfile: { findFirst } }) } as unknown as TenantTransactionService;
  const profiles = { upsert: vi.fn(), getForRegistration: vi.fn(), directory: vi.fn() };
  const meetings = { propose: vi.fn().mockResolvedValue({}), respondAsParticipant: vi.fn().mockResolvedValue({}), listForProfile: vi.fn().mockResolvedValue([]) };
  const introductions = { create: vi.fn().mockResolvedValue({}), listForProfile: vi.fn().mockResolvedValue([]) };
  const service = new ParticipantNetworkingService(
    tenantTransaction,
    profiles as unknown as ParticipantProfilesService,
    meetings as unknown as MeetingsService,
    introductions as unknown as IntroductionsService,
  );
  return { service, findFirst, meetings, introductions, profiles };
}

describe('ParticipantNetworkingService', () => {
  it('proposes a meeting as the participant\'s OWN profile, whatever the request says', async () => {
    const { service, meetings, findFirst } = harness({ id: 'profile-own' });
    await service.proposeMeeting(participant, { recipientProfileId: '33333333-3333-4333-8333-333333333333', note: 'hi' });

    expect(findFirst.mock.calls[0]?.[0].where).toEqual({ organizationId: 'org-1', eventId: 'event-1', registrationId: 'reg-1' });
    expect(meetings.propose).toHaveBeenCalledWith('event-1', expect.objectContaining({ proposerProfileId: 'profile-own' }));
  });

  it('requests an introduction as the participant\'s own profile', async () => {
    const { service, introductions } = harness({ id: 'profile-own' });
    await service.requestIntroduction(participant, { reason: 'Need help', offeredHelp: 'Advice' });

    expect(introductions.create).toHaveBeenCalledWith('event-1', { reason: 'Need help', offeredHelp: 'Advice', requestingProfileId: 'profile-own' });
  });

  it('answers meetings as the participant\'s own profile', async () => {
    const { service, meetings } = harness({ id: 'profile-own' });
    await service.respondToMeeting(participant, 'meeting-1', { action: 'cancel' });

    expect(meetings.respondAsParticipant).toHaveBeenCalledWith('event-1', 'profile-own', 'meeting-1', 'cancel');
  });

  it('asks for a profile before meetings or introductions, and does not call the modules', async () => {
    const { service, meetings, introductions } = harness(null);
    const errors = await Promise.all([
      service.listMeetings(participant).catch((e: unknown) => e),
      service.requestIntroduction(participant, { reason: 'x' }).catch((e: unknown) => e),
    ]);

    expect(errors.map((e) => (e as AppException).code)).toEqual(['profile_required', 'profile_required']);
    expect(meetings.listForProfile).not.toHaveBeenCalled();
    expect(introductions.create).not.toHaveBeenCalled();
  });

  it('saves the profile through the same service staff use, for this registration only', async () => {
    const { service, profiles } = harness(null);
    await service.saveProfile(participant, { headline: 'Founder' });

    expect(profiles.upsert).toHaveBeenCalledWith('event-1', 'reg-1', { headline: 'Founder' });
  });
});
