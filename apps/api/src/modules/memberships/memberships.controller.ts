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
  PERMISSIONS,
  inviteMemberRequestSchema,
  updateMemberRoleRequestSchema,
  type InvitationSummary,
  type InviteMemberRequest,
  type MemberSummary,
  type RoleSummary,
  type UpdateMemberRoleRequest,
} from '@event-platform/shared';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
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
  @RequirePermissions(PERMISSIONS.memberRead)
  @Get(':slug/members')
  list(): Promise<MemberSummary[]> {
    return this.memberships.listMembers();
  }

  @TenantScoped('slug')
  @RequirePermissions(PERMISSIONS.memberRead)
  @Get(':slug/roles')
  roles(): Promise<RoleSummary[]> {
    return this.memberships.listRoles();
  }

  @TenantScoped('slug')
  @RequirePermissions(PERMISSIONS.memberManage)
  @Idempotent()
  @Post(':slug/invitations')
  invite(
    @Body(new ZodValidationPipe(inviteMemberRequestSchema)) body: InviteMemberRequest,
  ): Promise<InvitationSummary> {
    return this.invitations.invite(body);
  }

  @TenantScoped('slug')
  @RequirePermissions(PERMISSIONS.memberManage)
  @Patch(':slug/members/:memberId')
  updateRole(
    @Param('memberId', new ParseUUIDPipe()) memberId: string,
    @Body(new ZodValidationPipe(updateMemberRoleRequestSchema)) body: UpdateMemberRoleRequest,
  ): Promise<MemberSummary> {
    return this.memberships.updateRole(memberId, body);
  }

  @TenantScoped('slug')
  @RequirePermissions(PERMISSIONS.memberManage)
  @Delete(':slug/members/:memberId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('memberId', new ParseUUIDPipe()) memberId: string): Promise<void> {
    return this.memberships.remove(memberId);
  }
}
