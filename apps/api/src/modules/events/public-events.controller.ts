import { Controller, Get, Param } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { EventsService, PublicEventContext } from './events.service';

/**
 * Public event surface. No session, no tenant header: the slug is the only input and
 * the query filters on visibility, status and organisation state.
 */
@Controller('public/events')
export class PublicEventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Public()
  @Get(':eventSlug/context')
  context(@Param('eventSlug') eventSlug: string): Promise<PublicEventContext> {
    return this.eventsService.getPublicContext(eventSlug);
  }

  @Public()
  @Get(':eventSlug')
  async detail(@Param('eventSlug') eventSlug: string): Promise<PublicEventContext['event']> {
    const context = await this.eventsService.getPublicContext(eventSlug);
    return context.event;
  }
}
