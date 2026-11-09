import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import {
  CheckInManifestEntry,
  CheckInStats,
  PERMISSIONS,
  ScanRequest,
  ScanResult,
  SyncScansRequest,
  scanSchema,
  syncScansSchema,
} from '@event-platform/shared';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { TenantScoped } from '../../common/decorators/tenant-scoped.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CheckInService } from './check-in.service';

@Controller('workspaces/:slug/events/:eventId/check-in')
@TenantScoped('slug')
export class CheckInController {
  constructor(private readonly checkIn: CheckInService) {}

  @Get('manifest')
  @RequirePermissions(PERMISSIONS.checkinOperate)
  manifest(@Param('eventId', new ParseUUIDPipe()) eventId: string): Promise<CheckInManifestEntry[]> {
    return this.checkIn.manifest(eventId);
  }

  @Post('scans')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.checkinOperate)
  scan(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Body(new ZodValidationPipe(scanSchema)) body: ScanRequest,
  ): Promise<ScanResult> {
    return this.checkIn.scan(eventId, body);
  }

  @Post('sync')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.checkinOperate)
  sync(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Body(new ZodValidationPipe(syncScansSchema)) body: SyncScansRequest,
  ): Promise<ScanResult[]> {
    return this.checkIn.sync(eventId, body.scans);
  }

  @Get('stats')
  @RequirePermissions(PERMISSIONS.checkinRead)
  stats(@Param('eventId', new ParseUUIDPipe()) eventId: string): Promise<CheckInStats> {
    return this.checkIn.stats(eventId);
  }

  @Get('lookup')
  @RequirePermissions(PERMISSIONS.checkinOperate)
  lookup(@Param('eventId', new ParseUUIDPipe()) eventId: string, @Query('q') q = '') {
    return q.trim().length < 2 ? Promise.resolve([]) : this.checkIn.lookup(eventId, q.trim().slice(0, 80));
  }
}
