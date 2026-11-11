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
  CAPABILITY_KEYS,
  listParticipantProfilesQuerySchema,
  moderateProfileRequestSchema,
  updateParticipantProfileRequestSchema,
  type ListParticipantProfilesQuery,
  type ModerateProfileRequest,
  type ParticipantProfile,
  type UpdateParticipantProfileRequest,
} from '@event-platform/shared';
import { RequireCapability } from '../../common/decorators/require-capability.decorator';
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
  @RequireCapability(CAPABILITY_KEYS.profilesView)
  list(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Query(new ZodValidationPipe(listParticipantProfilesQuerySchema))
    query: ListParticipantProfilesQuery,
  ): Promise<PaginatedResult<ParticipantProfile>> {
    return this.profiles.list(eventId, query);
  }

  @Get('profiles/:profileId')
  @RequireCapability(CAPABILITY_KEYS.profilesView)
  detail(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Param('profileId', new ParseUUIDPipe()) profileId: string,
  ): Promise<ParticipantProfile> {
    return this.profiles.detail(eventId, profileId);
  }

  @Put('registrations/:registrationId/profile')
  @RequireCapability(CAPABILITY_KEYS.profilesEdit)
  upsert(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Param('registrationId', new ParseUUIDPipe()) registrationId: string,
    @Body(new ZodValidationPipe(updateParticipantProfileRequestSchema))
    body: UpdateParticipantProfileRequest,
  ): Promise<ParticipantProfile> {
    return this.profiles.upsert(eventId, registrationId, body);
  }

  @Patch('profiles/:profileId')
  @RequireCapability(CAPABILITY_KEYS.profilesEdit)
  update(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Param('profileId', new ParseUUIDPipe()) profileId: string,
    @Body(new ZodValidationPipe(updateParticipantProfileRequestSchema))
    body: UpdateParticipantProfileRequest,
  ): Promise<ParticipantProfile> {
    return this.profiles.update(eventId, profileId, body);
  }

  @Post('profiles/:profileId/moderate')
  @RequireCapability(CAPABILITY_KEYS.profilesModerate)
  moderate(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Param('profileId', new ParseUUIDPipe()) profileId: string,
    @Body(new ZodValidationPipe(moderateProfileRequestSchema))
    body: ModerateProfileRequest,
  ): Promise<ParticipantProfile> {
    return this.profiles.moderate(eventId, profileId, body);
  }
}
