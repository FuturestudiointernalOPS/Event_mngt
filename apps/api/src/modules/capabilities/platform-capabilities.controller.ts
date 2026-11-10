import { Controller, Delete, Get, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import {
  CAPABILITY_KEYS,
  capabilityKeyParamSchema,
  type CapabilityCatalogueResponse,
  type OrganizationCapabilitiesView,
  type PlatformOrganizationSummary,
} from '@event-platform/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireCapability } from '../../common/decorators/require-capability.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { CapabilitiesService } from './capabilities.service';
import { PlatformCapabilitiesService } from './platform-capabilities.service';

/**
 * Platform administration: which organisations exist and what each is entitled to.
 *
 * These routes are the only capability-management paths that cross tenants. The guard
 * checks the verified platform administrator claim; the service scopes each query
 * either to the named organisation or to the narrow platform-admin database scope.
 */
@Controller('platform')
export class PlatformCapabilitiesController {
  constructor(
    private readonly capabilities: CapabilitiesService,
    private readonly platform: PlatformCapabilitiesService,
  ) {}

  @RequireCapability(CAPABILITY_KEYS.platformCapabilitiesView)
  @Get('capabilities')
  catalogue(): CapabilityCatalogueResponse {
    return this.capabilities.getCatalogue();
  }

  @RequireCapability(CAPABILITY_KEYS.platformOrganizationsManage)
  @Get('organizations')
  organizations(@CurrentUser() user: AuthenticatedUser): Promise<PlatformOrganizationSummary[]> {
    return this.platform.listOrganizations(user.id);
  }

  @RequireCapability(CAPABILITY_KEYS.platformOrganizationsManage)
  @Get('organizations/:organizationId/capabilities')
  organization(
    @CurrentUser() user: AuthenticatedUser,
    @Param('organizationId', new ParseUUIDPipe()) organizationId: string,
  ): Promise<OrganizationCapabilitiesView> {
    return this.platform.getOrganizationCapabilities(organizationId, user.id);
  }

  @RequireCapability(CAPABILITY_KEYS.platformOrganizationsManage)
  @Put('organizations/:organizationId/capabilities/:capabilityKey')
  grant(
    @CurrentUser() user: AuthenticatedUser,
    @Param('organizationId', new ParseUUIDPipe()) organizationId: string,
    @Param('capabilityKey', new ZodValidationPipe(capabilityKeyParamSchema)) capabilityKey: string,
  ): Promise<OrganizationCapabilitiesView> {
    return this.platform.assignOrganizationCapability(organizationId, capabilityKey, user.id);
  }

  @RequireCapability(CAPABILITY_KEYS.platformOrganizationsManage)
  @Delete('organizations/:organizationId/capabilities/:capabilityKey')
  revoke(
    @CurrentUser() user: AuthenticatedUser,
    @Param('organizationId', new ParseUUIDPipe()) organizationId: string,
    @Param('capabilityKey', new ZodValidationPipe(capabilityKeyParamSchema)) capabilityKey: string,
  ): Promise<OrganizationCapabilitiesView> {
    return this.platform.revokeOrganizationCapability(organizationId, capabilityKey, user.id);
  }
}
