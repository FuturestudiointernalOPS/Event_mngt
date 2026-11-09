import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Ip, Param, Post } from '@nestjs/common';
import {
  PublicRegistrationForm,
  PublicRegistrationResult,
  SubmitRegistrationRequest,
  submitRegistrationSchema,
} from '@event-platform/shared';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PublicRegistrationFormService } from './public-registration-form.service';
import { PublicRegistrationsService } from './public-registrations.service';

/** Registration needs no account. `Idempotency-Key` makes a retried submit safe. */
@Controller('public/events/:eventSlug')
@Public()
export class PublicRegistrationsController {
  constructor(
    private readonly registrations: PublicRegistrationsService,
    private readonly forms: PublicRegistrationFormService,
  ) {}

  @Get('registration-form')
  form(@Param('eventSlug') eventSlug: string): Promise<PublicRegistrationForm> {
    return this.forms.getForm(eventSlug);
  }

  // A person registers once; a script hammering this route is the abuse to stop.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('registrations')
  @HttpCode(HttpStatus.CREATED)
  submit(
    @Param('eventSlug') eventSlug: string,
    @Body(new ZodValidationPipe(submitRegistrationSchema)) body: SubmitRegistrationRequest,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Ip() ip: string,
  ): Promise<PublicRegistrationResult> {
    return this.registrations.submit(eventSlug, body, idempotencyKey?.slice(0, 100) ?? null, ip ?? null);
  }
}
