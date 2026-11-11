import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  CAPABILITY_KEYS,
  createOrganizationRequestSchema,
  type CreateOrganizationRequest,
  type OrganizationOnboardingResult,
} from '@event-platform/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireCapability } from '../../common/decorators/require-capability.decorator';
import { Idempotent } from '../../common/idempotency/idempotency.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { RATE_LIMIT_BUDGETS } from '../../common/rate-limit/rate-limit.budgets';
import { RateLimit } from '../../common/rate-limit/rate-limit.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { OrganizationsService } from './organizations.service';

/**
 * Account-level onboarding. This route is deliberately not tenant-scoped: the caller
 * has no workspace yet, and the organisation id is generated server-side.
 */
@Controller('onboarding')
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @RequireCapability(CAPABILITY_KEYS.organizationCreate)
  @RateLimit(...RATE_LIMIT_BUDGETS.workspace.onboarding)
  @Idempotent()
  @Post('organizations')
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body(new ZodValidationPipe(createOrganizationRequestSchema))
    body: CreateOrganizationRequest,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OrganizationOnboardingResult> {
    return this.organizations.createForAccount(body, user.id);
  }
}
