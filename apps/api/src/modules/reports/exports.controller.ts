import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  CAPABILITY_KEYS,
  createReportExportRequestSchema,
  listReportExportsQuerySchema,
  type CreateReportExportRequest,
  type ListReportExportsQuery,
  type ReportExport,
} from '@event-platform/shared';
import { RequireCapability } from '../../common/decorators/require-capability.decorator';
import { TenantScoped } from '../../common/decorators/tenant-scoped.decorator';
import { Idempotent } from '../../common/idempotency/idempotency.decorator';
import { RATE_LIMIT_BUDGETS } from '../../common/rate-limit/rate-limit.budgets';
import { RateLimit } from '../../common/rate-limit/rate-limit.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { PaginatedResult } from '../../common/types/authenticated-user';
import { ReportExportsService } from './report-exports.service';

/**
 * CSV/PDF export requests (WP-19).
 *
 * Creation answers 202 because the file does not exist yet; the client polls the
 * export row. The download writes bytes directly, so it opts out of the JSON envelope.
 */
@Controller('workspaces/:slug')
@TenantScoped('slug')
export class ExportsController {
  constructor(private readonly exports: ReportExportsService) {}

  @Post('events/:eventId/exports')
  @RequireCapability(CAPABILITY_KEYS.reportsExport)
  @RateLimit(...RATE_LIMIT_BUDGETS.workspace.reportExport)
  @HttpCode(HttpStatus.ACCEPTED)
  @Idempotent()
  create(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Body(new ZodValidationPipe(createReportExportRequestSchema))
    body: CreateReportExportRequest,
  ): Promise<ReportExport> {
    return this.exports.create(eventId, body);
  }

  @Get('events/:eventId/exports')
  @RequireCapability(CAPABILITY_KEYS.reportsView)
  list(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Query(new ZodValidationPipe(listReportExportsQuerySchema))
    query: ListReportExportsQuery,
  ): Promise<PaginatedResult<ReportExport>> {
    return this.exports.list(eventId, query);
  }

  @Get('exports/:exportId')
  @RequireCapability(CAPABILITY_KEYS.reportsView)
  detail(
    @Param('exportId', new ParseUUIDPipe()) exportId: string,
  ): Promise<ReportExport> {
    return this.exports.get(exportId);
  }

  @Get('exports/:exportId/download')
  @RequireCapability(CAPABILITY_KEYS.reportsExport)
  async download(
    @Param('exportId', new ParseUUIDPipe()) exportId: string,
    @Res() response: Response,
  ): Promise<void> {
    const file = await this.exports.download(exportId);

    response.setHeader('Content-Type', file.contentType);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.fileName}"`,
    );
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Length', String(file.content.byteLength));
    response.send(file.content);
  }
}
