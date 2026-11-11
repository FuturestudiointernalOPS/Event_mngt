import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  CAPABILITY_KEYS,
  purgeExpiredRequestSchema,
  type PurgeExpiredRequest,
  type PurgeExpiredResult,
} from '@event-platform/shared';
import { RequireCapability } from '../../common/decorators/require-capability.decorator';
import { TenantScoped } from '../../common/decorators/tenant-scoped.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { RegistrationsRetentionService } from './registrations-retention.service';

/** Staff-triggered purge of personal data past the workspace's retention period. */
@Controller('workspaces/:slug/retention')
@TenantScoped('slug')
export class RegistrationsRetentionController {
  constructor(private readonly retention: RegistrationsRetentionService) {}

  @Post('purge')
  @RequireCapability(CAPABILITY_KEYS.registrationsErase)
  @HttpCode(HttpStatus.OK)
  purge(
    @Body(new ZodValidationPipe(purgeExpiredRequestSchema)) body: PurgeExpiredRequest,
  ): Promise<PurgeExpiredResult> {
    return this.retention.purgeExpired(body.dryRun);
  }
}
