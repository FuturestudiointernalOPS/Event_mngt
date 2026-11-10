import { Controller, Delete, Get, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import {
  CAPABILITY_KEYS,
  capabilityKeyParamSchema,
  type MemberCapabilitiesView,
  type OrganizationCapabilitiesView,
} from '@event-platform/shared';
import { RequireCapability } from '../../common/decorators/require-capability.decorator';
import { TenantScoped } from '../../common/decorators/tenant-scoped.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CapabilitiesService } from './capabilities.service';

/**
 * Capability management for one workspace.
 *
 * `me` is how the SPA learns what the signed-in member may do. The other routes are
 * for administrators: they can inspect the organisation entitlement and distinguish a
 * role grant from a direct grant, but they can never grant outside the entitlement.
 */
@Controller('workspaces')
@TenantScoped('slug')
export class CapabilitiesController {
  constructor(private readonly capabilities: CapabilitiesService) {}

  /** No capability is required: every member may ask what they can do. */
  @Get(':slug/me/capabilities')
  self(): Promise<MemberCapabilitiesView> {
    return this.capabilities.getSelfCapabilities();
  }

  @RequireCapability(CAPABILITY_KEYS.organizationViewMembers)
  @Get(':slug/capabilities')
  organization(): Promise<OrganizationCapabilitiesView> {
    return this.capabilities.getWorkspaceOrganizationCapabilities();
  }

  @RequireCapability(CAPABILITY_KEYS.organizationViewMembers)
  @Get(':slug/members/:memberId/capabilities')
  member(
    @Param('memberId', new ParseUUIDPipe()) memberId: string,
  ): Promise<MemberCapabilitiesView> {
    return this.capabilities.getMemberCapabilities(memberId);
  }

  @RequireCapability(CAPABILITY_KEYS.organizationManagePermissions)
  @Put(':slug/members/:memberId/capabilities/:capabilityKey')
  grant(
    @Param('memberId', new ParseUUIDPipe()) memberId: string,
    @Param('capabilityKey', new ZodValidationPipe(capabilityKeyParamSchema)) capabilityKey: string,
  ): Promise<MemberCapabilitiesView> {
    return this.capabilities.assignMemberCapability(memberId, capabilityKey);
  }

  @RequireCapability(CAPABILITY_KEYS.organizationManagePermissions)
  @Delete(':slug/members/:memberId/capabilities/:capabilityKey')
  revoke(
    @Param('memberId', new ParseUUIDPipe()) memberId: string,
    @Param('capabilityKey', new ZodValidationPipe(capabilityKeyParamSchema)) capabilityKey: string,
  ): Promise<MemberCapabilitiesView> {
    return this.capabilities.revokeMemberCapability(memberId, capabilityKey);
  }
}
