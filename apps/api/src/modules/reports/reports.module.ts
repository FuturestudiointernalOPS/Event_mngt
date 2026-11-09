import { Module } from '@nestjs/common';
import { PublicStatsController, ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({ controllers: [ReportsController, PublicStatsController], providers: [ReportsService] })
export class ReportsModule {}
