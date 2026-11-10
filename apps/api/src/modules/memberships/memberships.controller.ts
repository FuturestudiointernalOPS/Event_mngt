import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  CAPABILITY_KEYS,
  inviteMemberRequestSchema,
  updateMemberRoleRequestSchema,
  type InvitationSummary,
  type InviteMemberRequest,
  type MemberSummary,
  type RoleSummary,
  type UpdateMemberRoleRequest,
} from '@event-platform/shared';
import { RequireCapability } from '../../common/decorators/require-capability.decorator';
import { Idempotent } from '../../common/idempotency/idempotency.decorator';
import { TenantScoped } from '../../common/decorators/tenant-scoped.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { InvitationsService } from './invitations.service';
import { MembershipsService } from './memberships.service';

/**
 * Team management for the current workspace.
 *
 * The routes only ever receive a workspace slug and a member id: the organisation
 * itself comes from the verified membership resolved by the guard.
 */
@Controller('workspaces')
export class MembershipsController {
  constructor(
    private readonly memberships: MembershipsService,
    private readonly invitations: InvitationsService,
  ) {}

  @TenantScoped('slug')
  @RequireCapability(CAPABILITY_KEYS.organizationViewMembers)
  @Get(':slug/members')
  list(): Promise<MemberSummary[]> {
    return this.memberships.listMembers();
  }

  @TenantScoped('slug')
  @RequireCapability(CAPABILITY_KEYS.organizationViewMembers)
  @Get(':slug/roles')
  roles(): Promise<RoleSummary[]> {
    return this.memberships.listRoles();
  }

  @TenantScoped('slug')
  @RequireCapability(CAPABILITY_KEYS.organizationViewMembers)
  @Get(':slug/invitations')
  listInvitations(): Promise<InvitationSummary[]> {
    return this.memberships.listInvitations();
  }

  @TenantScoped('slug')
  @RequireCapability(CAPABILITY_KEYS.organizationInviteMembers)
  @Idempotent()
  @Post(':slug/invitations')
  invite(
    @Body(new ZodValidationPipe(inviteMemberRequestSchema)) body: InviteMemberRequest,
  ): Promise<InvitationSummary> {
    return this.invitations.invite(body);
  }

  @TenantScoped('slug')
  @RequireCapability(CAPABILITY_KEYS.organizationInviteMembers)
  @Delete(':slug/invitations/:invitationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  revokeInvitation(
    @Param('invitationId', new ParseUUIDPipe()) invitationId: string,
  ): Promise<void> {
    return this.memberships.revokeInvitation(invitationId);
  }

  @TenantScoped('slug')
  @RequireCapability(CAPABILITY_KEYS.organizationManagePermissions)
  @Patch(':slug/members/:memberId')
  updateRole(
    @Param('memberId', new ParseUUIDPipe()) memberId: string,
    @Body(new ZodValidationPipe(updateMemberRoleRequestSchema)) body: UpdateMemberRoleRequest,
  ): Promise<MemberSummary> {
    return this.memberships.updateRole(memberId, body);
  }

  @TenantScoped('slug')
  @RequireCapability(CAPABILITY_KEYS.organizationRemoveMembers)
  @Delete(':slug/members/:memberId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('memberId', new ParseUUIDPipe()) memberId: string): Promise<void> {
    return this.memberships.remove(memberId);
  }
}
