import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  PERMISSIONS,
  listParticipantProfilesQuerySchema,
  moderateProfileRequestSchema,
  updateParticipantProfileRequestSchema,
  type ListParticipantProfilesQuery,
  type ModerateProfileRequest,
  type ParticipantProfile,
  type UpdateParticipantProfileRequest,
} from '@event-platform/shared';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { TenantScoped } from '../../common/decorators/tenant-scoped.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { PaginatedResult } from '../../common/types/authenticated-user';
import { ParticipantProfilesService } from './participant-profiles.service';

/** Participant profiles for one event, edited and moderated by staff. */
@Controller('workspaces/:slug/events/:eventId')
@TenantScoped('slug')
export class ParticipantProfilesController {
  constructor(private readonly profiles: ParticipantProfilesService) {}

  @Get('profiles')
  @RequirePermissions(PERMISSIONS.profileRead)
  list(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Query(new ZodValidationPipe(listParticipantProfilesQuerySchema))
    query: ListParticipantProfilesQuery,
  ): Promise<PaginatedResult<ParticipantProfile>> {
    return this.profiles.list(eventId, query);
  }

  @Get('profiles/:profileId')
  @RequirePermissions(PERMISSIONS.profileRead)
  detail(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Param('profileId', new ParseUUIDPipe()) profileId: string,
  ): Promise<ParticipantProfile> {
    return this.profiles.detail(eventId, profileId);
  }

  @Put('registrations/:registrationId/profile')
  @RequirePermissions(PERMISSIONS.registrationManage)
  upsert(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Param('registrationId', new ParseUUIDPipe()) registrationId: string,
    @Body(new ZodValidationPipe(updateParticipantProfileRequestSchema))
    body: UpdateParticipantProfileRequest,
  ): Promise<ParticipantProfile> {
    return this.profiles.upsert(eventId, registrationId, body);
  }

  @Patch('profiles/:profileId')
  @RequirePermissions(PERMISSIONS.registrationManage)
  update(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Param('profileId', new ParseUUIDPipe()) profileId: string,
    @Body(new ZodValidationPipe(updateParticipantProfileRequestSchema))
    body: UpdateParticipantProfileRequest,
  ): Promise<ParticipantProfile> {
    return this.profiles.update(eventId, profileId, body);
  }

  @Post('profiles/:profileId/moderate')
  @RequirePermissions(PERMISSIONS.profileModerate)
  moderate(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Param('profileId', new ParseUUIDPipe()) profileId: string,
    @Body(new ZodValidationPipe(moderateProfileRequestSchema))
    body: ModerateProfileRequest,
  ): Promise<ParticipantProfile> {
    return this.profiles.moderate(eventId, profileId, body);
  }
}
