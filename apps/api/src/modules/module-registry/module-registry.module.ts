import { Module } from '@nestjs/common';
import { ModuleRegistryController } from './module-registry.controller';
import { ModuleRegistryRepository } from './module-registry.repository';
import { ModuleRegistryService } from './module-registry.service';

@Module({
  controllers: [ModuleRegistryController],
  providers: [ModuleRegistryService, ModuleRegistryRepository],
  exports: [ModuleRegistryService],
})
export class ModuleRegistryModule {}
