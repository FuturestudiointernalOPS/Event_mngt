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
  PERMISSIONS,
  createIntroductionRequestSchema,
  listIntroductionRequestsQuerySchema,
  updateIntroductionRequestSchema,
  type CreateIntroductionRequest,
  type IntroductionRequest,
  type IntroductionRequestDetail,
  type ListIntroductionRequestsQuery,
  type UpdateIntroductionRequest,
} from '@event-platform/shared';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
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
  @RequirePermissions(PERMISSIONS.introductionRead)
  list(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Query(new ZodValidationPipe(listIntroductionRequestsQuerySchema))
    query: ListIntroductionRequestsQuery,
  ): Promise<PaginatedResult<IntroductionRequest>> {
    return this.introductions.list(eventId, query);
  }

  @Post('introductions')
  @RequirePermissions(PERMISSIONS.introductionManage)
  create(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Body(new ZodValidationPipe(createIntroductionRequestSchema))
    body: CreateIntroductionRequest,
  ): Promise<IntroductionRequest> {
    return this.introductions.create(eventId, body);
  }

  @Get('introductions/:introductionId')
  @RequirePermissions(PERMISSIONS.introductionRead)
  detail(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Param('introductionId', new ParseUUIDPipe()) introductionId: string,
  ): Promise<IntroductionRequestDetail> {
    return this.introductions.detail(eventId, introductionId);
  }

  @Patch('introductions/:introductionId')
  @RequirePermissions(PERMISSIONS.introductionManage)
  update(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Param('introductionId', new ParseUUIDPipe()) introductionId: string,
    @Body(new ZodValidationPipe(updateIntroductionRequestSchema))
    body: UpdateIntroductionRequest,
  ): Promise<IntroductionRequest> {
    return this.introductions.update(eventId, introductionId, body);
  }
}
