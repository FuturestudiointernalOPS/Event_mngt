import { Global, Module } from '@nestjs/common';
import { RateLimitMaintenanceService } from './rate-limit.maintenance';
import { RateLimitRepository } from './rate-limit.repository';
import { RateLimiterService } from './rate-limit.service';

@Global()
@Module({
  providers: [
    RateLimiterService,
    RateLimitRepository,
    RateLimitMaintenanceService,
  ],
  exports: [RateLimiterService],
})
export class RateLimitModule {}
