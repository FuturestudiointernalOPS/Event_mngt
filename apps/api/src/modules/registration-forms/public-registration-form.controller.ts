import { Controller, Get, Param } from '@nestjs/common';
import type { PublicRegistrationForm } from '@event-platform/shared';
import { Public } from '../../common/decorators/public.decorator';
import { PublicRegistrationFormService } from './public-registration-form.service';

/**
 * Anonymous registration page. No session, no tenant header: the event slug is the only
 * input and the service filters on visibility, status, module activation and window.
 */
@Controller('public/events')
export class PublicRegistrationFormController {
  constructor(private readonly forms: PublicRegistrationFormService) {}

  @Public()
  @Get(':eventSlug/registration-form')
  show(@Param('eventSlug') eventSlug: string): Promise<PublicRegistrationForm> {
    return this.forms.get(eventSlug);
  }
}
