import { Controller, Get, Param } from '@nestjs/common';
import type { PublicShowcase } from '@event-platform/shared';
import { Public } from '../../common/decorators/public.decorator';
import { ShowcaseService } from './showcase.service';

@Controller('public/events/:eventSlug')
@Public()
export class PublicShowcaseController {
  constructor(private readonly showcase: ShowcaseService) {}

  @Get('showcase')
  get(@Param('eventSlug') eventSlug: string): Promise<PublicShowcase> {
    return this.showcase.publicShowcase(eventSlug);
  }
}
