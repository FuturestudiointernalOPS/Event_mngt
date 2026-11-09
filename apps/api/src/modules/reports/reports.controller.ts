import { Controller, Get, Param, ParseUUIDPipe, Res } from '@nestjs/common';
import type { Response } from 'express';
import {
  EditionComparison,
  EventSummaryReport,
  OrganisationOverview,
  PERMISSIONS,
  PublicEventStats,
} from '@event-platform/shared';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { TenantScoped } from '../../common/decorators/tenant-scoped.decorator';
import { ReportsService } from './reports.service';

@Controller('workspaces/:slug')
@TenantScoped('slug')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('reports/overview')
  @RequirePermissions(PERMISSIONS.reportRead)
  overview(): Promise<OrganisationOverview> {
    return this.reports.organisationOverview();
  }

  @Get('events/:eventId/reports/summary')
  @RequirePermissions(PERMISSIONS.reportRead)
  summary(@Param('eventId', new ParseUUIDPipe()) eventId: string): Promise<EventSummaryReport> {
    return this.reports.eventSummary(eventId);
  }

  @Get('events/:eventId/reports/editions')
  @RequirePermissions(PERMISSIONS.reportRead)
  editions(@Param('eventId', new ParseUUIDPipe()) eventId: string): Promise<EditionComparison> {
    return this.reports.editionComparison(eventId);
  }

  /** Sent straight to the response: a CSV file is not a JSON envelope. */
  @Get('events/:eventId/reports/registrations.csv')
  @RequirePermissions(PERMISSIONS.reportExport)
  async registrationsCsv(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Res() response: Response,
  ): Promise<void> {
    const csv = await this.reports.registrationsCsv(eventId);
    response
      .status(200)
      .type('text/csv; charset=utf-8')
      .set('Content-Disposition', 'attachment; filename="registrations.csv"')
      .send(csv);
  }
}

@Controller('public/events/:eventSlug')
@Public()
export class PublicStatsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('stats')
  stats(@Param('eventSlug') eventSlug: string): Promise<PublicEventStats> {
    return this.reports.publicStats(eventSlug);
  }
}
