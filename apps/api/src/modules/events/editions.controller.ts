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
  PERMISSIONS,
  createEditionRequestSchema,
  listEditionsQuerySchema,
  type CreateEditionRequest,
  type EventDetail,
  type EventSummary,
  type ListEditionsQuery,
} from '@event-platform/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Idempotent } from '../../common/idempotency/idempotency.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
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
  @RequirePermissions(PERMISSIONS.eventRead)
  list(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Query(new ZodValidationPipe(listEditionsQuerySchema)) query: ListEditionsQuery,
  ): Promise<PaginatedResult<EventSummary>> {
    return this.editions.list(eventId, query);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.eventManage)
  @Idempotent()
  create(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Body(new ZodValidationPipe(createEditionRequestSchema)) body: CreateEditionRequest,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EventDetail> {
    return this.editions.create(eventId, body, user.id);
  }

  @Get(':editionId')
  @RequirePermissions(PERMISSIONS.eventRead)
  detail(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Param('editionId', new ParseUUIDPipe()) editionId: string,
  ): Promise<EventDetail> {
    return this.editions.getOne(eventId, editionId);
  }
}
