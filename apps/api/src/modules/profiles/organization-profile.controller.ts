import {
  Body,
  Controller,
  Get,
  Post,
  Put,
} from '@nestjs/common';
import {
  CAPABILITY_KEYS,
  moderateProfileRequestSchema,
  upsertOrganizationProfileRequestSchema,
  type ModerateProfileRequest,
  type OrganizationProfile,
  type UpsertOrganizationProfileRequest,
} from '@event-platform/shared';
import { RequireCapability } from '../../common/decorators/require-capability.decorator';
import { TenantScoped } from '../../common/decorators/tenant-scoped.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { OrganizationProfileService } from './organization-profile.service';

/** The workspace's own listing. */
@Controller('workspaces/:slug/organization-profile')
@TenantScoped('slug')
export class OrganizationProfileController {
  constructor(private readonly profiles: OrganizationProfileService) {}

  @Get()
  @RequireCapability(CAPABILITY_KEYS.profilesView)
  get(): Promise<OrganizationProfile | null> {
    return this.profiles.get();
  }

  @Put()
  @RequireCapability(CAPABILITY_KEYS.organizationEdit)
  upsert(
    @Body(new ZodValidationPipe(upsertOrganizationProfileRequestSchema))
    body: UpsertOrganizationProfileRequest,
  ): Promise<OrganizationProfile> {
    return this.profiles.upsert(body);
  }

  @Post('moderate')
  @RequireCapability(CAPABILITY_KEYS.profilesModerate)
  moderate(
    @Body(new ZodValidationPipe(moderateProfileRequestSchema))
    body: ModerateProfileRequest,
  ): Promise<OrganizationProfile> {
    return this.profiles.moderate(body);
  }
}
