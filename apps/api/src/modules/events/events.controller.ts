import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  CreateEventRequest,
  EventDetail,
  EventSummary,
  ListEventsQuery,
  CAPABILITY_KEYS,
  createEventRequestSchema,
  eventTransitionRequestSchema,
  listEventsQuerySchema,
  updateEventRequestSchema,
  type EventTransitionRequest,
  type UpdateEventRequest,
} from '@event-platform/shared';
import { EventBannerService } from './event-banner.service';
import { MAX_BRANDING_ASSET_BYTES, type BrandingAssetFile } from './event-banner.rules';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Idempotent } from '../../common/idempotency/idempotency.decorator';
import { RequireCapability } from '../../common/decorators/require-capability.decorator';
import { TenantScoped } from '../../common/decorators/tenant-scoped.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser, PaginatedResult } from '../../common/types/authenticated-user';
import { DuplicateEventService } from './events.duplicate.service';
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
    private readonly duplication: DuplicateEventService,
    private readonly banner: EventBannerService,
  ) {}

  @Get()
  @RequireCapability(CAPABILITY_KEYS.eventsView)
  list(
    @Query(new ZodValidationPipe(listEventsQuerySchema)) query: ListEventsQuery,
  ): Promise<PaginatedResult<EventSummary>> {
    return this.eventsService.list(query);
  }

  @Post()
  @RequireCapability(CAPABILITY_KEYS.eventsCreate)
  @Idempotent()
  create(
    @Body(new ZodValidationPipe(createEventRequestSchema)) body: CreateEventRequest,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EventDetail> {
    return this.eventsService.create(body, user.id);
  }

  @Get(':eventId')
  @RequireCapability(CAPABILITY_KEYS.eventsView)
  detail(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
  ): Promise<EventDetail> {
    return this.eventsService.getById(eventId);
  }

  @Post(':eventId/publish')
  @RequireCapability(CAPABILITY_KEYS.eventsPublish)
  publish(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
  ): Promise<EventDetail> {
    return this.eventsService.publish(eventId);
  }

  @Patch(':eventId')
  @RequireCapability(CAPABILITY_KEYS.eventsCreate)
  update(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Body(new ZodValidationPipe(updateEventRequestSchema)) body: UpdateEventRequest,
  ): Promise<EventDetail> {
    return this.eventsService.update(eventId, body);
  }

  @Post(':eventId/banner')
  @RequireCapability(CAPABILITY_KEYS.eventsCreate)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_BRANDING_ASSET_BYTES } }))
  uploadBanner(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @UploadedFile() file: BrandingAssetFile | undefined,
  ): Promise<{ bannerUrl: string }> {
    return this.banner.upload(eventId, file);
  }

  @Post(':eventId/transitions')
  @RequireCapability(CAPABILITY_KEYS.eventsPublish)
  transition(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Body(new ZodValidationPipe(eventTransitionRequestSchema))
    body: EventTransitionRequest,
  ): Promise<EventDetail> {
    return this.eventsService.transition(eventId, body.action);
  }

  @Post(':eventId/duplicate')
  @RequireCapability(CAPABILITY_KEYS.eventsCreate)
  @Idempotent()
  duplicate(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EventDetail> {
    return this.duplication.duplicate(eventId, user.id);
  }
}
