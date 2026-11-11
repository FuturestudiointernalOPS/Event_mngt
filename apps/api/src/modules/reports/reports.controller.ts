import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import {
  CAPABILITY_KEYS,
  type EditionComparison,
  type EventReport,
  type OrganizationReport,
} from '@event-platform/shared';
import { RequireCapability } from '../../common/decorators/require-capability.decorator';
import { TenantScoped } from '../../common/decorators/tenant-scoped.decorator';
import { ReportsService } from './reports.service';

/** Staff dashboards: one event, the organisation portfolio, and editions (WP-18). */
@Controller('workspaces/:slug')
@TenantScoped('slug')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('events/:eventId/reports/summary')
  @RequireCapability(CAPABILITY_KEYS.reportsView)
  eventSummary(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
  ): Promise<EventReport> {
    return this.reports.eventSummary(eventId);
  }

  @Get('reports/summary')
  @RequireCapability(CAPABILITY_KEYS.reportsView)
  organizationSummary(): Promise<OrganizationReport> {
    return this.reports.organizationSummary();
  }

  @Get('events/:eventId/reports/editions')
  @RequireCapability(CAPABILITY_KEYS.reportsView)
  editions(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
  ): Promise<EditionComparison> {
    return this.reports.editionComparison(eventId);
  }
}
