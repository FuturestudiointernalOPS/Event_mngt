import { Global, Module } from '@nestjs/common';
import { RateLimitRepository } from './rate-limit.repository';
import { RateLimiterService } from './rate-limit.service';

@Global()
@Module({
  providers: [RateLimiterService, RateLimitRepository],
  exports: [RateLimiterService],
})
export class RateLimitModule {}
