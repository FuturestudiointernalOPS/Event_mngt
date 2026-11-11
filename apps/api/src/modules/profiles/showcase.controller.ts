import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  CAPABILITY_KEYS,
  createInnovationRequestSchema,
  listInnovationsQuerySchema,
  moderateProfileRequestSchema,
  type CreateInnovationRequest,
  type Innovation,
  type ListInnovationsQuery,
  type ModerateProfileRequest,
} from '@event-platform/shared';
import { RequireCapability } from '../../common/decorators/require-capability.decorator';
import { TenantScoped } from '../../common/decorators/tenant-scoped.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { PaginatedResult } from '../../common/types/authenticated-user';
import { ShowcaseService } from './showcase.service';

/** Showcase listings for one event. */
@Controller('workspaces/:slug/events/:eventId/showcase')
@TenantScoped('slug')
export class ShowcaseController {
  constructor(private readonly showcase: ShowcaseService) {}

  @Get()
  @RequireCapability(CAPABILITY_KEYS.profilesView)
  list(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Query(new ZodValidationPipe(listInnovationsQuerySchema))
    query: ListInnovationsQuery,
  ): Promise<PaginatedResult<Innovation>> {
    return this.showcase.list(eventId, query);
  }

  @Post()
  @RequireCapability(CAPABILITY_KEYS.profilesEdit)
  create(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Body(new ZodValidationPipe(createInnovationRequestSchema))
    body: CreateInnovationRequest,
  ): Promise<Innovation> {
    return this.showcase.create(eventId, body);
  }

  @Post(':innovationId/moderate')
  @RequireCapability(CAPABILITY_KEYS.profilesModerate)
  moderate(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Param('innovationId', new ParseUUIDPipe()) innovationId: string,
    @Body(new ZodValidationPipe(moderateProfileRequestSchema))
    body: ModerateProfileRequest,
  ): Promise<Innovation> {
    return this.showcase.moderate(eventId, innovationId, body);
  }
}
