import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import {
  createIntroductionRequestSchema,
  participantMeetingRequestSchema,
  participantMeetingResponseSchema,
  updateParticipantProfileRequestSchema,
  type CreateIntroductionRequest,
  type IntroductionRequest,
  type Meeting,
  type ParticipantDataExport,
  type ParticipantDirectoryEntry,
  type ParticipantMeetingRequest,
  type ParticipantMeetingResponse,
  type ParticipantOverview,
  type ParticipantProfile,
  type UpdateParticipantProfileRequest,
} from '@event-platform/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentParticipant, ParticipantScoped } from '../../common/decorators/participant-scoped.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RATE_LIMIT_BUDGETS } from '../../common/rate-limit/rate-limit.budgets';
import { RateLimit } from '../../common/rate-limit/rate-limit.decorator';
import type { ParticipantAccess } from '../../common/types/authenticated-user';
import { ParticipantNetworkingService } from './participant-networking.service';
import { ParticipantPortalService } from './participant-portal.service';

/**
 * The registrant's own space, reached with the credential in their e-mailed link. These
 * routes need no staff capability: they can only ever touch the one registration the
 * credential proved.
 */
@Controller('participant')
@Public()
@ParticipantScoped()
export class ParticipantPortalController {
  constructor(
    private readonly portal: ParticipantPortalService,
    private readonly networking: ParticipantNetworkingService,
  ) {}

  @RateLimit(...RATE_LIMIT_BUDGETS.participant.read)
  @Get('me')
  me(@CurrentParticipant() participant: ParticipantAccess): Promise<ParticipantOverview> {
    return this.portal.overview(participant);
  }

  @RateLimit(...RATE_LIMIT_BUDGETS.participant.read)
  @Get('export')
  exportData(@CurrentParticipant() participant: ParticipantAccess): Promise<ParticipantDataExport> {
    return this.portal.exportData(participant);
  }

  @RateLimit(...RATE_LIMIT_BUDGETS.participant.destructive)
  @Post('withdraw')
  @HttpCode(HttpStatus.NO_CONTENT)
  withdraw(@CurrentParticipant() participant: ParticipantAccess): Promise<void> {
    return this.portal.withdraw(participant);
  }

  @RateLimit(...RATE_LIMIT_BUDGETS.participant.destructive)
  @Post('erase')
  @HttpCode(HttpStatus.NO_CONTENT)
  erase(@CurrentParticipant() participant: ParticipantAccess): Promise<void> {
    return this.portal.erase(participant);
  }

  @RateLimit(...RATE_LIMIT_BUDGETS.participant.read)
  @Get('profile')
  profile(@CurrentParticipant() participant: ParticipantAccess): Promise<ParticipantProfile | null> {
    return this.networking.profile(participant);
  }

  @RateLimit(...RATE_LIMIT_BUDGETS.participant.write)
  @Put('profile')
  saveProfile(
    @CurrentParticipant() participant: ParticipantAccess,
    @Body(new ZodValidationPipe(updateParticipantProfileRequestSchema)) body: UpdateParticipantProfileRequest,
  ): Promise<ParticipantProfile> {
    return this.networking.saveProfile(participant, body);
  }

  @RateLimit(...RATE_LIMIT_BUDGETS.participant.read)
  @Get('directory')
  directory(@CurrentParticipant() participant: ParticipantAccess): Promise<ParticipantDirectoryEntry[]> {
    return this.networking.directory(participant);
  }

  @RateLimit(...RATE_LIMIT_BUDGETS.participant.read)
  @Get('meetings')
  meetings(@CurrentParticipant() participant: ParticipantAccess): Promise<Meeting[]> {
    return this.networking.listMeetings(participant);
  }

  @RateLimit(...RATE_LIMIT_BUDGETS.participant.write)
  @Post('meetings')
  proposeMeeting(
    @CurrentParticipant() participant: ParticipantAccess,
    @Body(new ZodValidationPipe(participantMeetingRequestSchema)) body: ParticipantMeetingRequest,
  ): Promise<Meeting> {
    return this.networking.proposeMeeting(participant, body);
  }

  @RateLimit(...RATE_LIMIT_BUDGETS.participant.write)
  @Post('meetings/:meetingId/respond')
  @HttpCode(HttpStatus.OK)
  respondToMeeting(
    @CurrentParticipant() participant: ParticipantAccess,
    @Param('meetingId', new ParseUUIDPipe()) meetingId: string,
    @Body(new ZodValidationPipe(participantMeetingResponseSchema)) body: ParticipantMeetingResponse,
  ): Promise<Meeting> {
    return this.networking.respondToMeeting(participant, meetingId, body);
  }

  @RateLimit(...RATE_LIMIT_BUDGETS.participant.read)
  @Get('introductions')
  introductions(@CurrentParticipant() participant: ParticipantAccess): Promise<IntroductionRequest[]> {
    return this.networking.listIntroductions(participant);
  }

  @RateLimit(...RATE_LIMIT_BUDGETS.participant.write)
  @Post('introductions')
  requestIntroduction(
    @CurrentParticipant() participant: ParticipantAccess,
    @Body(new ZodValidationPipe(createIntroductionRequestSchema.omit({ requestingProfileId: true })))
    body: Omit<CreateIntroductionRequest, 'requestingProfileId'>,
  ): Promise<IntroductionRequest> {
    return this.networking.requestIntroduction(participant, body);
  }
}
