import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import {
  DirectoryEntry,
  InnovationInput,
  InnovationView,
  IntroductionView,
  MeetingView,
  ParticipantDataExport,
  ProfileView,
  ProposeMeetingRequest,
  RequestIntroductionRequest,
  RespondMeetingRequest,
  UpsertProfileRequest,
  innovationInputSchema,
  proposeMeetingSchema,
  requestIntroductionSchema,
  respondMeetingSchema,
  upsertProfileSchema,
} from '@event-platform/shared';
import { CurrentParticipant, ParticipantScoped } from '../../common/decorators/participant-scoped.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { ParticipantAccess } from '../../common/types/authenticated-user';
import { DataRightsService } from '../data-rights/data-rights.service';
import { IntroductionsService } from './introductions.service';
import { MeetingsService } from './meetings.service';
import { ParticipantPortalService, type ParticipantOverview } from './participant-portal.service';
import { ParticipantShowcaseService } from './participant-showcase.service';

/** Everything a registered participant can do, authenticated by the e-mailed credential. */
@Controller('participant')
@Public()
@ParticipantScoped()
export class ParticipantPortalController {
  constructor(
    private readonly portal: ParticipantPortalService,
    private readonly showcase: ParticipantShowcaseService,
    private readonly rights: DataRightsService,
    private readonly meetings: MeetingsService,
    private readonly introductions: IntroductionsService,
  ) {}

  @Get('me')
  me(@CurrentParticipant() p: ParticipantAccess): Promise<ParticipantOverview> {
    return this.portal.overview(p);
  }

  @Get('export')
  exportData(@CurrentParticipant() p: ParticipantAccess): Promise<ParticipantDataExport> {
    return this.rights.exportMine(p);
  }

  @Post('erase')
  @HttpCode(HttpStatus.NO_CONTENT)
  erase(@CurrentParticipant() p: ParticipantAccess): Promise<void> {
    return this.rights.eraseMine(p);
  }

  @Post('cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@CurrentParticipant() p: ParticipantAccess): Promise<{ status: string }> {
    return this.portal.cancel(p);
  }

  @Get('profile')
  profile(@CurrentParticipant() p: ParticipantAccess): Promise<ProfileView | null> {
    return this.showcase.getProfile(p);
  }

  @Put('profile')
  saveProfile(
    @CurrentParticipant() p: ParticipantAccess,
    @Body(new ZodValidationPipe(upsertProfileSchema)) body: UpsertProfileRequest,
  ): Promise<ProfileView> {
    return this.showcase.upsertProfile(p, body);
  }

  @Get('innovations')
  innovations(@CurrentParticipant() p: ParticipantAccess): Promise<InnovationView[]> {
    return this.showcase.listInnovations(p);
  }

  @Post('innovations')
  createInnovation(
    @CurrentParticipant() p: ParticipantAccess,
    @Body(new ZodValidationPipe(innovationInputSchema)) body: InnovationInput,
  ): Promise<InnovationView> {
    return this.showcase.saveInnovation(p, body);
  }

  @Put('innovations/:id')
  updateInnovation(
    @CurrentParticipant() p: ParticipantAccess,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(innovationInputSchema)) body: InnovationInput,
  ): Promise<InnovationView> {
    return this.showcase.saveInnovation(p, body, id);
  }

  @Delete('innovations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteInnovation(@CurrentParticipant() p: ParticipantAccess, @Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    return this.showcase.deleteInnovation(p, id);
  }

  @Get('directory')
  directory(@CurrentParticipant() p: ParticipantAccess): Promise<DirectoryEntry[]> {
    return this.showcase.directory(p);
  }

  @Get('showcase-innovations')
  showcaseInnovations(@CurrentParticipant() p: ParticipantAccess): Promise<InnovationView[]> {
    return this.showcase.approvedInnovations(p);
  }

  @Get('meetings')
  listMeetings(@CurrentParticipant() p: ParticipantAccess): Promise<MeetingView[]> {
    return this.meetings.listMine(p);
  }

  @Post('meetings')
  propose(
    @CurrentParticipant() p: ParticipantAccess,
    @Body(new ZodValidationPipe(proposeMeetingSchema)) body: ProposeMeetingRequest,
  ): Promise<MeetingView> {
    return this.meetings.propose(p, body);
  }

  @Post('meetings/:id/respond')
  @HttpCode(HttpStatus.OK)
  respond(
    @CurrentParticipant() p: ParticipantAccess,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(respondMeetingSchema)) body: RespondMeetingRequest,
  ): Promise<MeetingView> {
    return this.meetings.respond(p, id, body);
  }

  @Get('introductions')
  listIntroductions(@CurrentParticipant() p: ParticipantAccess): Promise<IntroductionView[]> {
    return this.introductions.listMine(p);
  }

  @Post('introductions')
  requestIntroduction(
    @CurrentParticipant() p: ParticipantAccess,
    @Body(new ZodValidationPipe(requestIntroductionSchema)) body: RequestIntroductionRequest,
  ): Promise<IntroductionView> {
    return this.introductions.request(p, body);
  }
}
