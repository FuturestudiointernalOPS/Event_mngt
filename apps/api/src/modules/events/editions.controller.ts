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
  createEditionRequestSchema,
  listEditionsQuerySchema,
  type CreateEditionRequest,
  type EventDetail,
  type EventSummary,
  type ListEditionsQuery,
} from '@event-platform/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Idempotent } from '../../common/idempotency/idempotency.decorator';
import { RequireCapability } from '../../common/decorators/require-capability.decorator';
import { TenantScoped } from '../../common/decorators/tenant-scoped.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser, PaginatedResult } from '../../common/types/authenticated-user';
import { EditionsService } from './editions.service';

/**
 * Editions of a recurring event. The parent id comes from the route and is resolved
 * inside the tenant transaction; it is never trusted from the body.
 */
@Controller('workspaces/:slug/events/:eventId/editions')
@TenantScoped('slug')
export class EditionsController {
  constructor(private readonly editions: EditionsService) {}

  @Get()
  @RequireCapability(CAPABILITY_KEYS.editionsView)
  list(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Query(new ZodValidationPipe(listEditionsQuerySchema)) query: ListEditionsQuery,
  ): Promise<PaginatedResult<EventSummary>> {
    return this.editions.list(eventId, query);
  }

  @Post()
  @RequireCapability(CAPABILITY_KEYS.editionsCreate)
  @Idempotent()
  create(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Body(new ZodValidationPipe(createEditionRequestSchema)) body: CreateEditionRequest,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EventDetail> {
    return this.editions.create(eventId, body, user.id);
  }

  @Get(':editionId')
  @RequireCapability(CAPABILITY_KEYS.editionsView)
  detail(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Param('editionId', new ParseUUIDPipe()) editionId: string,
  ): Promise<EventDetail> {
    return this.editions.getOne(eventId, editionId);
  }
}
