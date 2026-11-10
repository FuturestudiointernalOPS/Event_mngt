import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  CAPABILITY_KEYS,
  createMeetingRequestSchema,
  listMeetingsQuerySchema,
  updateMeetingRequestSchema,
  type CreateMeetingRequest,
  type ListMeetingsQuery,
  type Meeting,
  type UpdateMeetingRequest,
} from '@event-platform/shared';
import { RequireCapability } from '../../common/decorators/require-capability.decorator';
import { TenantScoped } from '../../common/decorators/tenant-scoped.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { PaginatedResult } from '../../common/types/authenticated-user';
import { MeetingsService } from './meetings.service';

/** Meetings between two participant profiles, operated by staff. */
@Controller('workspaces/:slug/events/:eventId')
@TenantScoped('slug')
export class MeetingsController {
  constructor(private readonly meetings: MeetingsService) {}

  @Get('meetings')
  @RequireCapability(CAPABILITY_KEYS.meetingsView)
  list(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Query(new ZodValidationPipe(listMeetingsQuerySchema))
    query: ListMeetingsQuery,
  ): Promise<PaginatedResult<Meeting>> {
    return this.meetings.list(eventId, query);
  }

  @Post('meetings')
  @RequireCapability(CAPABILITY_KEYS.meetingsManage)
  propose(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Body(new ZodValidationPipe(createMeetingRequestSchema))
    body: CreateMeetingRequest,
  ): Promise<Meeting> {
    return this.meetings.propose(eventId, body);
  }

  @Patch('meetings/:meetingId')
  @RequireCapability(CAPABILITY_KEYS.meetingsManage)
  update(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Param('meetingId', new ParseUUIDPipe()) meetingId: string,
    @Body(new ZodValidationPipe(updateMeetingRequestSchema))
    body: UpdateMeetingRequest,
  ): Promise<Meeting> {
    return this.meetings.update(eventId, meetingId, body);
  }
}
