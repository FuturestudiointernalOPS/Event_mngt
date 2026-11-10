import { Module } from '@nestjs/common';
import { EditionsController } from './editions.controller';
import { EditionsRepository } from './editions.repository';
import { EditionsService } from './editions.service';
import { EventsController } from './events.controller';
import { DuplicateEventService } from './events.duplicate.service';
import { EventsRepository } from './events.repository';
import { EventsService } from './events.service';
import { PublicEventsController } from './public-events.controller';

@Module({
  controllers: [EventsController, PublicEventsController, EditionsController],
  providers: [EventsService, EventsRepository, DuplicateEventService, EditionsService, EditionsRepository],
  exports: [EventsService],
})
export class EventsModule {}
