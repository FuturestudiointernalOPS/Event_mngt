import { Module } from '@nestjs/common';
import { ModuleRegistryModule } from '../module-registry/module-registry.module';
import { IntroductionsController } from './introductions.controller';
import { IntroductionsRepository } from './introductions.repository';
import { IntroductionsService } from './introductions.service';

@Module({
  imports: [ModuleRegistryModule],
  controllers: [IntroductionsController],
  providers: [IntroductionsService, IntroductionsRepository],
  exports: [IntroductionsService],
})
export class IntroductionsModule {}
