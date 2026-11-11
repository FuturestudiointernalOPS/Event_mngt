import { Module } from '@nestjs/common';
import { CapabilitiesController } from './capabilities.controller';
import { CapabilitiesRepository } from './capabilities.repository';
import { CapabilitiesService } from './capabilities.service';
import { PlatformCapabilitiesController } from './platform-capabilities.controller';
import { PlatformCapabilitiesService } from './platform-capabilities.service';

/**
 * Capability management and evaluation. The guard lives in `common/` because it runs
 * on every request; this module owns the catalogue-facing operations and persistence.
 */
@Module({
  controllers: [CapabilitiesController, PlatformCapabilitiesController],
  providers: [CapabilitiesService, PlatformCapabilitiesService, CapabilitiesRepository],
  exports: [CapabilitiesService],
})
export class CapabilitiesModule {}
