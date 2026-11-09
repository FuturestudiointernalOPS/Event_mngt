import { Module } from '@nestjs/common';
import { EventChangesService } from './event-changes.service';
import { EventsController } from './events.controller';
import { EventsRepository } from './events.repository';
import { EventsService } from './events.service';
import { PublicEventsController } from './public-events.controller';

@Module({
  controllers: [EventsController, PublicEventsController],
  providers: [EventsService, EventChangesService, EventsRepository],
  exports: [EventsService],
})
export class EventsModule {}
