import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  mfaCodeRequestSchema,
  type MfaCodeRequest,
  type MfaSetup,
  type MfaStatus,
} from '@event-platform/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RATE_LIMIT_BUDGETS } from '../../common/rate-limit/rate-limit.budgets';
import { RateLimit } from '../../common/rate-limit/rate-limit.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { MfaService } from './mfa.service';

/** Self-service two-factor management for the signed-in user. */
@Controller('auth/mfa')
export class MfaController {
  constructor(private readonly mfa: MfaService) {}

  @Get()
  status(@CurrentUser() user: AuthenticatedUser): Promise<MfaStatus> {
    return this.mfa.status(user.id);
  }

  @Post('setup')
  @RateLimit(...RATE_LIMIT_BUDGETS.auth.mfaSetup)
  @HttpCode(HttpStatus.OK)
  setup(@CurrentUser() user: AuthenticatedUser): Promise<MfaSetup> {
    return this.mfa.setup(user.id);
  }

  @Post('enable')
  @RateLimit(...RATE_LIMIT_BUDGETS.auth.mfaEnable)
  @HttpCode(HttpStatus.OK)
  enable(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(mfaCodeRequestSchema)) body: MfaCodeRequest,
  ): Promise<{ recoveryCodes: string[] }> {
    return this.mfa.enable(user.id, body.code);
  }

  @Post('disable')
  @RateLimit(...RATE_LIMIT_BUDGETS.auth.mfaDisable)
  @HttpCode(HttpStatus.NO_CONTENT)
  disable(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(mfaCodeRequestSchema)) body: MfaCodeRequest,
  ): Promise<void> {
    return this.mfa.disable(user.id, body.code);
  }
}
