import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import {
  PERMISSIONS,
  PurgeRequest,
  PurgeResult,
  RetentionSettings,
  purgeRequestSchema,
  retentionSettingsSchema,
} from '@event-platform/shared';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { TenantScoped } from '../../common/decorators/tenant-scoped.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { DataRightsService } from './data-rights.service';

/** Staff-side data rights: erase a person, configure and run retention. */
@Controller('workspaces/:slug')
@TenantScoped('slug')
export class DataRightsController {
  constructor(private readonly rights: DataRightsService) {}

  @Post('events/:eventId/registrations/:id/erase')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.registrationManage)
  erase(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    return this.rights.eraseRegistration(eventId, id);
  }

  @Get('data-retention')
  @RequirePermissions(PERMISSIONS.workspaceManage)
  retention(): Promise<RetentionSettings> {
    return this.rights.getRetention();
  }

  @Put('data-retention')
  @RequirePermissions(PERMISSIONS.workspaceManage)
  setRetention(
    @Body(new ZodValidationPipe(retentionSettingsSchema)) body: RetentionSettings,
  ): Promise<RetentionSettings> {
    return this.rights.setRetention(body);
  }

  @Post('data-retention/purge')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.workspaceManage)
  purge(@Body(new ZodValidationPipe(purgeRequestSchema)) body: PurgeRequest): Promise<PurgeResult> {
    return this.rights.purgeExpired(body.dryRun);
  }
}
