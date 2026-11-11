import { Module } from '@nestjs/common';
import { BadgesModule } from '../badges/badges.module';
import { ModuleRegistryModule } from '../module-registry/module-registry.module';
import { CheckInSyncService } from './check-in-sync.service';
import { CheckInsController } from './check-ins.controller';
import { CheckInsRepository } from './check-ins.repository';
import { CheckInsService } from './check-ins.service';

/** Wiring only. Attendance rules live in the service, queries in the repository. */
@Module({
  imports: [ModuleRegistryModule, BadgesModule],
  controllers: [CheckInsController],
  providers: [CheckInsService, CheckInSyncService, CheckInsRepository],
})
export class CheckInModule {}
