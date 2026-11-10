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
  createIntroductionRequestSchema,
  listIntroductionRequestsQuerySchema,
  updateIntroductionRequestSchema,
  type CreateIntroductionRequest,
  type IntroductionRequest,
  type IntroductionRequestDetail,
  type ListIntroductionRequestsQuery,
  type UpdateIntroductionRequest,
} from '@event-platform/shared';
import { RequireCapability } from '../../common/decorators/require-capability.decorator';
import { TenantScoped } from '../../common/decorators/tenant-scoped.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { PaginatedResult } from '../../common/types/authenticated-user';
import { IntroductionsService } from './introductions.service';

/** The staff introduction queue for one event. History is read-only. */
@Controller('workspaces/:slug/events/:eventId')
@TenantScoped('slug')
export class IntroductionsController {
  constructor(private readonly introductions: IntroductionsService) {}

  @Get('introductions')
  @RequireCapability(CAPABILITY_KEYS.introductionsView)
  list(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Query(new ZodValidationPipe(listIntroductionRequestsQuerySchema))
    query: ListIntroductionRequestsQuery,
  ): Promise<PaginatedResult<IntroductionRequest>> {
    return this.introductions.list(eventId, query);
  }

  @Post('introductions')
  @RequireCapability(CAPABILITY_KEYS.introductionsManage)
  create(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Body(new ZodValidationPipe(createIntroductionRequestSchema))
    body: CreateIntroductionRequest,
  ): Promise<IntroductionRequest> {
    return this.introductions.create(eventId, body);
  }

  @Get('introductions/:introductionId')
  @RequireCapability(CAPABILITY_KEYS.introductionsView)
  detail(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Param('introductionId', new ParseUUIDPipe()) introductionId: string,
  ): Promise<IntroductionRequestDetail> {
    return this.introductions.detail(eventId, introductionId);
  }

  @Patch('introductions/:introductionId')
  @RequireCapability(CAPABILITY_KEYS.introductionsManage)
  update(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Param('introductionId', new ParseUUIDPipe()) introductionId: string,
    @Body(new ZodValidationPipe(updateIntroductionRequestSchema))
    body: UpdateIntroductionRequest,
  ): Promise<IntroductionRequest> {
    return this.introductions.update(eventId, introductionId, body);
  }
}
