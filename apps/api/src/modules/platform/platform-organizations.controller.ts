import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  CAPABILITY_KEYS,
  createPlatformOrganizationRequestSchema,
  listPlatformOrganizationsQuerySchema,
  updateOrganizationStatusRequestSchema,
  type CreatePlatformOrganizationRequest,
  type ListPlatformOrganizationsQuery,
  type PlatformOrganizationDetail,
  type PlatformOrganizationOverview,
  type UpdateOrganizationStatusRequest,
} from '@event-platform/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireCapability } from '../../common/decorators/require-capability.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser, PaginatedResult } from '../../common/types/authenticated-user';
import { PlatformOrganizationsService } from './platform-organizations.service';

/**
 * Platform oversight: the organisation portfolio, one organisation's support summary,
 * creation on behalf of an owner, and suspension/reactivation.
 *
 * The overview route is declared before the identifier route so the static path wins.
 */
@Controller('platform')
export class PlatformOrganizationsController {
  constructor(private readonly organizations: PlatformOrganizationsService) {}

  @RequireCapability(CAPABILITY_KEYS.platformOrganizationsManage)
  @Get('organizations/overview')
  overview(
    @Query(new ZodValidationPipe(listPlatformOrganizationsQuerySchema))
    query: ListPlatformOrganizationsQuery,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaginatedResult<PlatformOrganizationOverview>> {
    return this.organizations.overview(query, user.id);
  }

  @RequireCapability(CAPABILITY_KEYS.platformOrganizationsManage)
  @Get('organizations/:organizationId')
  detail(
    @Param('organizationId', new ParseUUIDPipe()) organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PlatformOrganizationDetail> {
    return this.organizations.detail(organizationId, user.id);
  }

  @RequireCapability(CAPABILITY_KEYS.platformOrganizationsManage)
  @Post('organizations')
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body(new ZodValidationPipe(createPlatformOrganizationRequestSchema))
    body: CreatePlatformOrganizationRequest,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PlatformOrganizationDetail> {
    return this.organizations.create(body, user.id);
  }

  @RequireCapability(CAPABILITY_KEYS.platformOrganizationsManage)
  @Patch('organizations/:organizationId/status')
  updateStatus(
    @Param('organizationId', new ParseUUIDPipe()) organizationId: string,
    @Body(new ZodValidationPipe(updateOrganizationStatusRequestSchema))
    body: UpdateOrganizationStatusRequest,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PlatformOrganizationDetail> {
    return this.organizations.updateStatus(organizationId, body, user.id);
  }
}
