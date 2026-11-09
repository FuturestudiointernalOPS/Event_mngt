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
  CreateEventRequest,
  EventDetail,
  EventSummary,
  ListEventsQuery,
  PERMISSIONS,
  UpdateEventRequest,
  createEventRequestSchema,
  listEventsQuerySchema,
  updateEventRequestSchema,
} from '@event-platform/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { TenantScoped } from '../../common/decorators/tenant-scoped.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser, PaginatedResult } from '../../common/types/authenticated-user';
import { EventChangesService } from './event-changes.service';
import { EventsService } from './events.service';

/**
 * Tenant-scoped event management.
 *
 * @TenantScoped('slug') makes TenantAccessGuard resolve the workspace from the route
 * and verify membership before any handler runs. See docs/03-tenant-isolation-and-rls.md.
 */
@Controller('workspaces/:slug/events')
@TenantScoped('slug')
export class EventsController {
  constructor(
    private readonly eventsService: EventsService,
    private readonly changes: EventChangesService,
  ) {}

  @Get()
  @RequirePermissions(PERMISSIONS.eventRead)
  list(
    @Query(new ZodValidationPipe(listEventsQuerySchema)) query: ListEventsQuery,
  ): Promise<PaginatedResult<EventSummary>> {
    return this.eventsService.list(query);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.eventManage)
  create(
    @Body(new ZodValidationPipe(createEventRequestSchema)) body: CreateEventRequest,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EventDetail> {
    return this.eventsService.create(body, user.id);
  }

  @Get(':eventId')
  @RequirePermissions(PERMISSIONS.eventRead)
  detail(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
  ): Promise<EventDetail> {
    return this.eventsService.getById(eventId);
  }

  @Post(':eventId/publish')
  @RequirePermissions(PERMISSIONS.eventPublish)
  publish(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
  ): Promise<EventDetail> {
    return this.eventsService.publish(eventId);
  }

  @Patch(':eventId')
  @RequirePermissions(PERMISSIONS.eventManage)
  update(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Body(new ZodValidationPipe(updateEventRequestSchema)) body: UpdateEventRequest,
  ): Promise<EventDetail> {
    return this.changes.update(eventId, body);
  }

  @Post(':eventId/unpublish')
  @RequirePermissions(PERMISSIONS.eventPublish)
  unpublish(@Param('eventId', new ParseUUIDPipe()) eventId: string): Promise<EventDetail> {
    return this.changes.transition(eventId, 'unpublish');
  }

  @Post(':eventId/complete')
  @RequirePermissions(PERMISSIONS.eventManage)
  complete(@Param('eventId', new ParseUUIDPipe()) eventId: string): Promise<EventDetail> {
    return this.changes.transition(eventId, 'complete');
  }

  @Post(':eventId/cancel')
  @RequirePermissions(PERMISSIONS.eventManage)
  cancel(@Param('eventId', new ParseUUIDPipe()) eventId: string): Promise<EventDetail> {
    return this.changes.transition(eventId, 'cancel');
  }

  @Post(':eventId/archive')
  @RequirePermissions(PERMISSIONS.eventManage)
  archive(@Param('eventId', new ParseUUIDPipe()) eventId: string): Promise<EventDetail> {
    return this.changes.transition(eventId, 'archive');
  }

  @Post(':eventId/duplicate')
  @RequirePermissions(PERMISSIONS.eventManage)
  duplicate(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EventDetail> {
    return this.changes.duplicate(eventId, user.id);
  }
}
