import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { ModuleRegistryModule } from '../module-registry/module-registry.module';
import { PublicMetricsController } from './public-metrics.controller';
import { PublicMetricsRepository } from './public-metrics.repository';
import { PublicMetricsService } from './public-metrics.service';

/** Public anonymised statistics (WP-20). */
@Module({
  imports: [EventsModule, ModuleRegistryModule],
  controllers: [PublicMetricsController],
  providers: [PublicMetricsService, PublicMetricsRepository],
})
export class AnalyticsModule {}
