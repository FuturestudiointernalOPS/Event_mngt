import { Controller, Get, Param } from '@nestjs/common';
import type { PublicShowcase } from '@event-platform/shared';
import { Public } from '../../common/decorators/public.decorator';
import { PublicShowcaseService } from './public-showcase.service';

/** Anonymous showcase. Approved and public listings only. */
@Controller('public/events')
export class PublicShowcaseController {
  constructor(private readonly showcase: PublicShowcaseService) {}

  @Public()
  @Get(':eventSlug/showcase')
  get(@Param('eventSlug') eventSlug: string): Promise<PublicShowcase> {
    return this.showcase.get(eventSlug);
  }
}
