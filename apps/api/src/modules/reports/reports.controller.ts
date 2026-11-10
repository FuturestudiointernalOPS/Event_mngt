import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import {
  PERMISSIONS,
  type EditionComparison,
  type EventReport,
  type OrganizationReport,
} from '@event-platform/shared';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { TenantScoped } from '../../common/decorators/tenant-scoped.decorator';
import { ReportsService } from './reports.service';

/** Staff dashboards: one event, the organisation portfolio, and editions (WP-18). */
@Controller('workspaces/:slug')
@TenantScoped('slug')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('events/:eventId/reports/summary')
  @RequirePermissions(PERMISSIONS.reportRead)
  eventSummary(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
  ): Promise<EventReport> {
    return this.reports.eventSummary(eventId);
  }

  @Get('reports/summary')
  @RequirePermissions(PERMISSIONS.reportRead)
  organizationSummary(): Promise<OrganizationReport> {
    return this.reports.organizationSummary();
  }

  @Get('events/:eventId/reports/editions')
  @RequirePermissions(PERMISSIONS.reportRead)
  editions(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
  ): Promise<EditionComparison> {
    return this.reports.editionComparison(eventId);
  }
}
