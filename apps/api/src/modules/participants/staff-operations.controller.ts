import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import {
  AssignIntroductionRequest,
  DecideIntroductionRequest,
  InnovationView,
  IntroductionView,
  ListIntroductionsQuery,
  MeetingOutcomeRequest,
  MeetingView,
  ModerationDecision,
  PERMISSIONS,
  ProfileView,
  assignIntroductionSchema,
  decideIntroductionSchema,
  listIntroductionsQuerySchema,
  meetingOutcomeSchema,
  moderationDecisionSchema,
} from '@event-platform/shared';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { TenantScoped } from '../../common/decorators/tenant-scoped.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { PaginatedResult } from '../../common/types/authenticated-user';
import { IntroductionsService } from './introductions.service';
import { MeetingsService } from './meetings.service';
import { ShowcaseService } from './showcase.service';

const uuid = () => new ParseUUIDPipe();

/** Staff side of showcase moderation, meetings and the introduction queue. */
@Controller('workspaces/:slug/events/:eventId')
@TenantScoped('slug')
export class StaffOperationsController {
  constructor(
    private readonly showcase: ShowcaseService,
    private readonly meetings: MeetingsService,
    private readonly introductions: IntroductionsService,
  ) {}

  @Get('showcase/profiles')
  @RequirePermissions(PERMISSIONS.profileRead)
  profiles(@Param('eventId', uuid()) eventId: string): Promise<ProfileView[]> {
    return this.showcase.listProfiles(eventId);
  }

  @Get('showcase/innovations')
  @RequirePermissions(PERMISSIONS.profileRead)
  innovations(@Param('eventId', uuid()) eventId: string): Promise<InnovationView[]> {
    return this.showcase.listInnovations(eventId);
  }

  @Post('showcase/:kind/:id/moderation')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.profileModerate)
  moderate(
    @Param('eventId', uuid()) eventId: string,
    @Param('kind') kind: string,
    @Param('id', uuid()) id: string,
    @Body(new ZodValidationPipe(moderationDecisionSchema)) body: ModerationDecision,
  ): Promise<void> {
    return this.showcase.moderate(kind === 'innovations' ? 'innovations' : 'profiles', eventId, id, body);
  }

  @Get('meetings')
  @RequirePermissions(PERMISSIONS.meetingRead)
  listMeetings(@Param('eventId', uuid()) eventId: string): Promise<MeetingView[]> {
    return this.meetings.listForEvent(eventId);
  }

  @Post('meetings/:id/confirm')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.meetingManage)
  confirmMeeting(
    @Param('eventId', uuid()) eventId: string,
    @Param('id', uuid()) id: string,
  ): Promise<MeetingView> {
    return this.meetings.confirm(eventId, id);
  }

  @Put('meetings/:id/outcome')
  @RequirePermissions(PERMISSIONS.meetingManage)
  outcome(
    @Param('eventId', uuid()) eventId: string,
    @Param('id', uuid()) id: string,
    @Body(new ZodValidationPipe(meetingOutcomeSchema)) body: MeetingOutcomeRequest,
  ): Promise<MeetingView> {
    return this.meetings.recordOutcome(eventId, id, body);
  }

  @Get('introductions')
  @RequirePermissions(PERMISSIONS.introductionRead)
  listIntroductions(
    @Param('eventId', uuid()) eventId: string,
    @Query(new ZodValidationPipe(listIntroductionsQuerySchema)) query: ListIntroductionsQuery,
  ): Promise<PaginatedResult<IntroductionView>> {
    return this.introductions.list(eventId, query);
  }

  @Put('introductions/:id/assignee')
  @RequirePermissions(PERMISSIONS.introductionManage)
  assign(
    @Param('eventId', uuid()) eventId: string,
    @Param('id', uuid()) id: string,
    @Body(new ZodValidationPipe(assignIntroductionSchema)) body: AssignIntroductionRequest,
  ): Promise<IntroductionView> {
    return this.introductions.assign(eventId, id, body);
  }

  @Post('introductions/:id/decision')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.introductionManage)
  decide(
    @Param('eventId', uuid()) eventId: string,
    @Param('id', uuid()) id: string,
    @Body(new ZodValidationPipe(decideIntroductionSchema)) body: DecideIntroductionRequest,
  ): Promise<IntroductionView> {
    return this.introductions.decide(eventId, id, body);
  }
}
