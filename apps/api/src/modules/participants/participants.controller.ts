import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import {
  PERMISSIONS,
  listParticipantsQuerySchema,
  type ListParticipantsQuery,
  type ParticipantDetail,
  type ParticipantSummary,
} from '@event-platform/shared';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { TenantScoped } from '../../common/decorators/tenant-scoped.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { PaginatedResult } from '../../common/types/authenticated-user';
import { ParticipantsService } from './participants.service';

/** People registered for one event. */
@Controller('workspaces/:slug/events/:eventId/participants')
@TenantScoped('slug')
export class ParticipantsController {
  constructor(private readonly participants: ParticipantsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.participantRead)
  list(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Query(new ZodValidationPipe(listParticipantsQuerySchema))
    query: ListParticipantsQuery,
  ): Promise<PaginatedResult<ParticipantSummary>> {
    return this.participants.list(eventId, query);
  }

  @Get(':personId')
  @RequirePermissions(PERMISSIONS.participantRead)
  detail(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Param('personId', new ParseUUIDPipe()) personId: string,
  ): Promise<ParticipantDetail> {
    return this.participants.detail(eventId, personId);
  }
}
