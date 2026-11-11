import { Injectable } from '@nestjs/common';
import type {
  CreateIntroductionRequest,
  IntroductionRequest,
  Meeting,
  ParticipantDirectoryEntry,
  ParticipantMeetingRequest,
  ParticipantMeetingResponse,
  ParticipantProfile,
  UpdateParticipantProfileRequest,
} from '@event-platform/shared';
import { AppException } from '../../common/app-exception';
import type { ParticipantAccess } from '../../common/types/authenticated-user';
import { TenantTransactionService } from '../../database/tenant-transaction.service';
import { IntroductionsService } from '../introductions/introductions.service';
import { MeetingsService } from '../meetings/meetings.service';
import { ParticipantProfilesService } from '../profiles/participant-profiles.service';

/**
 * Showcase, meetings and introductions from the participant's side.
 *
 * Everything is expressed through the owning modules' services, so the staff surface and
 * the participant surface cannot disagree about a rule. The participant can only name
 * their own profile: it is resolved from the credential, never taken from the request.
 */
@Injectable()
export class ParticipantNetworkingService {
  constructor(
    private readonly tenantTransaction: TenantTransactionService,
    private readonly profiles: ParticipantProfilesService,
    private readonly meetings: MeetingsService,
    private readonly introductions: IntroductionsService,
  ) {}

  profile(participant: ParticipantAccess): Promise<ParticipantProfile | null> {
    return this.profiles.getForRegistration(participant.eventId, participant.registrationId);
  }

  /** Saving always goes through the same rules as staff: content edits need re-approval. */
  saveProfile(
    participant: ParticipantAccess,
    input: UpdateParticipantProfileRequest,
  ): Promise<ParticipantProfile> {
    return this.profiles.upsert(participant.eventId, participant.registrationId, input);
  }

  directory(participant: ParticipantAccess): Promise<ParticipantDirectoryEntry[]> {
    return this.profiles.directory(participant.eventId, participant.registrationId);
  }

  async listMeetings(participant: ParticipantAccess): Promise<Meeting[]> {
    const own = await this.requireOwnProfile(participant);
    return this.meetings.listForProfile(participant.eventId, own.id);
  }

  async proposeMeeting(participant: ParticipantAccess, input: ParticipantMeetingRequest): Promise<Meeting> {
    const own = await this.requireOwnProfile(participant);
    return this.meetings.propose(participant.eventId, {
      proposerProfileId: own.id,
      recipientProfileId: input.recipientProfileId,
      durationMinutes: input.durationMinutes,
      note: input.note,
    });
  }

  async respondToMeeting(
    participant: ParticipantAccess,
    meetingId: string,
    input: ParticipantMeetingResponse,
  ): Promise<Meeting> {
    const own = await this.requireOwnProfile(participant);
    return this.meetings.respondAsParticipant(participant.eventId, own.id, meetingId, input.action);
  }

  async listIntroductions(participant: ParticipantAccess): Promise<IntroductionRequest[]> {
    const own = await this.requireOwnProfile(participant);
    return this.introductions.listForProfile(participant.eventId, own.id);
  }

  async requestIntroduction(
    participant: ParticipantAccess,
    input: Omit<CreateIntroductionRequest, 'requestingProfileId'>,
  ): Promise<IntroductionRequest> {
    const own = await this.requireOwnProfile(participant);
    return this.introductions.create(participant.eventId, { ...input, requestingProfileId: own.id });
  }

  /** The participant's profile id, or a clear refusal when they have not written one yet. */
  private async requireOwnProfile(participant: ParticipantAccess): Promise<{ id: string }> {
    const own = await this.tenantTransaction.withTenant((tx) =>
      tx.participantProfile.findFirst({
        where: {
          organizationId: participant.organizationId,
          eventId: participant.eventId,
          registrationId: participant.registrationId,
        },
        select: { id: true },
      }),
    );

    if (!own) {
      throw AppException.unprocessable('profile_required', 'Create your profile first.');
    }

    return own;
  }
}
