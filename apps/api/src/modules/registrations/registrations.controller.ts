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
  decideRegistrationRequestSchema,
  listRegistrationsQuerySchema,
  type DecideRegistrationRequest,
  type ListRegistrationsQuery,
  type RegistrationDetail,
  type RegistrationSummary,
} from '@event-platform/shared';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { TenantScoped } from '../../common/decorators/tenant-scoped.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { PaginatedResult } from '../../common/types/authenticated-user';
import { RegistrationsService } from './registrations.service';

/** Staff registration list, detail and the approval decisions. */
@Controller('workspaces/:slug/events/:eventId/registrations')
@TenantScoped('slug')
export class RegistrationsController {
  constructor(private readonly registrations: RegistrationsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.registrationRead)
  list(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Query(new ZodValidationPipe(listRegistrationsQuerySchema))
    query: ListRegistrationsQuery,
  ): Promise<PaginatedResult<RegistrationSummary>> {
    return this.registrations.list(eventId, query);
  }

  @Get(':registrationId')
  @RequirePermissions(PERMISSIONS.registrationRead)
  detail(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Param('registrationId', new ParseUUIDPipe()) registrationId: string,
  ): Promise<RegistrationDetail> {
    return this.registrations.detail(eventId, registrationId);
  }

  @Post(':registrationId/approve')
  @RequirePermissions(PERMISSIONS.registrationManage)
  approve(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Param('registrationId', new ParseUUIDPipe()) registrationId: string,
    @Body(new ZodValidationPipe(decideRegistrationRequestSchema))
    body: DecideRegistrationRequest,
  ): Promise<RegistrationDetail> {
    return this.registrations.approve(eventId, registrationId, body);
  }

  @Post(':registrationId/reject')
  @RequirePermissions(PERMISSIONS.registrationManage)
  reject(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Param('registrationId', new ParseUUIDPipe()) registrationId: string,
    @Body(new ZodValidationPipe(decideRegistrationRequestSchema))
    body: DecideRegistrationRequest,
  ): Promise<RegistrationDetail> {
    return this.registrations.reject(eventId, registrationId, body);
  }
}
