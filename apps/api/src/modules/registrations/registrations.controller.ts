import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import {
  DecideRegistrationRequest,
  ListRegistrationsQuery,
  PERMISSIONS,
  RegistrationDetail,
  RegistrationSummary,
  decideRegistrationSchema,
  listRegistrationsQuerySchema,
} from '@event-platform/shared';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { TenantScoped } from '../../common/decorators/tenant-scoped.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { PaginatedResult } from '../../common/types/authenticated-user';
import { RegistrationsService } from './registrations.service';

@Controller('workspaces/:slug/events/:eventId/registrations')
@TenantScoped('slug')
export class RegistrationsController {
  constructor(private readonly registrations: RegistrationsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.registrationRead)
  list(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Query(new ZodValidationPipe(listRegistrationsQuerySchema)) query: ListRegistrationsQuery,
  ): Promise<PaginatedResult<RegistrationSummary>> {
    return this.registrations.list(eventId, query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.registrationRead)
  detail(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<RegistrationDetail> {
    return this.registrations.detail(eventId, id);
  }

  @Post(':id/decision')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.registrationManage)
  decide(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(decideRegistrationSchema)) body: DecideRegistrationRequest,
  ): Promise<RegistrationDetail> {
    return this.registrations.decide(eventId, id, body);
  }

  @Post(':id/resend-access')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.registrationManage)
  resend(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    return this.registrations.resendAccess(eventId, id);
  }
}
