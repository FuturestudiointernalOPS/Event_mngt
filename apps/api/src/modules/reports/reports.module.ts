import { Module } from '@nestjs/common';
import { ExportsController } from './exports.controller';
import { ReportExportWorker } from './report-export-worker.service';
import { ReportExportsRepository } from './report-exports.repository';
import { ReportExportsService } from './report-exports.service';
import { ReportsController } from './reports.controller';
import { ReportsPortfolioRepository } from './reports-portfolio.repository';
import { ReportsRepository } from './reports.repository';
import { ReportsService } from './reports.service';

/** Aggregates and report exports (WP-18, WP-19). */
@Module({
  controllers: [ReportsController, ExportsController],
  providers: [
    ReportsService,
    ReportsRepository,
    ReportsPortfolioRepository,
    ReportExportsService,
    ReportExportsRepository,
    ReportExportWorker,
  ],
})
export class ReportsModule {}
