import { Controller, Get, Param } from '@nestjs/common';
import type { PublicMetrics } from '@event-platform/shared';
import { Public } from '../../common/decorators/public.decorator';
import { PublicMetricsService } from './public-metrics.service';

/** Anonymous metrics. Counts only, suppressed below the disclosure threshold. */
@Controller('public/events')
export class PublicMetricsController {
  constructor(private readonly metrics: PublicMetricsService) {}

  @Public()
  @Get(':eventSlug/metrics')
  get(@Param('eventSlug') eventSlug: string): Promise<PublicMetrics> {
    return this.metrics.get(eventSlug);
  }
}
