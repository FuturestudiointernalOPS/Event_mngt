import {
  Body,
  Controller,
  Get,
  Post,
  Put,
} from '@nestjs/common';
import {
  PERMISSIONS,
  moderateProfileRequestSchema,
  upsertOrganizationProfileRequestSchema,
  type ModerateProfileRequest,
  type OrganizationProfile,
  type UpsertOrganizationProfileRequest,
} from '@event-platform/shared';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { TenantScoped } from '../../common/decorators/tenant-scoped.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { OrganizationProfileService } from './organization-profile.service';

/** The workspace's own listing. */
@Controller('workspaces/:slug/organization-profile')
@TenantScoped('slug')
export class OrganizationProfileController {
  constructor(private readonly profiles: OrganizationProfileService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.profileRead)
  get(): Promise<OrganizationProfile | null> {
    return this.profiles.get();
  }

  @Put()
  @RequirePermissions(PERMISSIONS.workspaceManage)
  upsert(
    @Body(new ZodValidationPipe(upsertOrganizationProfileRequestSchema))
    body: UpsertOrganizationProfileRequest,
  ): Promise<OrganizationProfile> {
    return this.profiles.upsert(body);
  }

  @Post('moderate')
  @RequirePermissions(PERMISSIONS.profileModerate)
  moderate(
    @Body(new ZodValidationPipe(moderateProfileRequestSchema))
    body: ModerateProfileRequest,
  ): Promise<OrganizationProfile> {
    return this.profiles.moderate(body);
  }
}
