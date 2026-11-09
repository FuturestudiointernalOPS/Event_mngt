import { Module } from '@nestjs/common';
import { EventBannerController } from './event-banner.controller';
import { EventModulesController } from './event-modules.controller';
import { EventModulesService } from './event-modules.service';
import { EventChangesService } from './event-changes.service';
import { EventsController } from './events.controller';
import { EventsRepository } from './events.repository';
import { EventsService } from './events.service';
import { PublicEventsController } from './public-events.controller';

@Module({
  controllers: [EventsController, EventModulesController, EventBannerController, PublicEventsController],
  providers: [EventsService, EventChangesService, EventModulesService, EventsRepository],
  exports: [EventsService],
})
export class EventsModule {}
