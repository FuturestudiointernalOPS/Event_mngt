import { Body, Controller, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import {
  submitRegistrationRequestSchema,
  type RegistrationReceipt,
  type SubmitRegistrationRequest,
} from '@event-platform/shared';
import { Public } from '../../common/decorators/public.decorator';
import { Idempotent } from '../../common/idempotency/idempotency.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { RATE_LIMIT_BUDGETS } from '../../common/rate-limit/rate-limit.budgets';
import { RateLimit } from '../../common/rate-limit/rate-limit.decorator';
import { RegistrationSubmissionService } from './registration-submission.service';

/**
 * The only unauthenticated write in the product.
 *
 * The event slug resolves the organisation server-side, the route is rate-limited by
 * IP, and an `Idempotency-Key` header makes a retry return the first receipt.
 */
@Controller('public/events')
export class PublicRegistrationsController {
  constructor(private readonly submissions: RegistrationSubmissionService) {}

  @Public()
  @RateLimit(...RATE_LIMIT_BUDGETS.public.registration)
  @Idempotent()
  @Post(':eventSlug/registrations')
  submit(
    @Param('eventSlug') eventSlug: string,
    @Body(new ZodValidationPipe(submitRegistrationRequestSchema))
    body: SubmitRegistrationRequest,
    @Req() request: Request,
  ): Promise<RegistrationReceipt> {
    return this.submissions.submit(eventSlug, body, request.ip ?? null);
  }
}
