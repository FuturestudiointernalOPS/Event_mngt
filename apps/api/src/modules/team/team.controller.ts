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
  AcceptInvitationRequest,
  InviteMemberRequest,
  Invitation,
  PERMISSIONS,
  RoleSummary,
  TeamMember,
  UpdateMemberRequest,
  acceptInvitationRequestSchema,
  inviteMemberRequestSchema,
  updateMemberRequestSchema,
} from '@event-platform/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { TenantScoped } from '../../common/decorators/tenant-scoped.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { InvitationsService } from './invitations.service';
import { TeamService } from './team.service';

@Controller('workspaces/:slug/team')
@TenantScoped('slug')
export class TeamController {
  constructor(
    private readonly team: TeamService,
    private readonly invitationsService: InvitationsService,
  ) {}

  @Get('members')
  @RequirePermissions(PERMISSIONS.memberRead)
  members(): Promise<TeamMember[]> {
    return this.team.listMembers();
  }

  @Get('roles')
  @RequirePermissions(PERMISSIONS.memberRead)
  roles(): Promise<RoleSummary[]> {
    return this.team.listRoles();
  }

  @Patch('members/:memberId')
  @RequirePermissions(PERMISSIONS.memberManage)
  updateMember(
    @Param('memberId', new ParseUUIDPipe()) memberId: string,
    @Body(new ZodValidationPipe(updateMemberRequestSchema)) body: UpdateMemberRequest,
  ): Promise<TeamMember> {
    return this.team.updateMember(memberId, body);
  }

  @Delete('members/:memberId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.memberManage)
  removeMember(@Param('memberId', new ParseUUIDPipe()) memberId: string): Promise<void> {
    return this.team.removeMember(memberId);
  }

  @Get('invitations')
  @RequirePermissions(PERMISSIONS.memberRead)
  invitations(): Promise<Invitation[]> {
    return this.invitationsService.listInvitations();
  }

  @Post('invitations')
  @RequirePermissions(PERMISSIONS.memberManage)
  invite(
    @Body(new ZodValidationPipe(inviteMemberRequestSchema)) body: InviteMemberRequest,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Invitation> {
    return this.invitationsService.invite(body, user.id);
  }

  @Delete('invitations/:invitationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.memberManage)
  revoke(@Param('invitationId', new ParseUUIDPipe()) invitationId: string): Promise<void> {
    return this.invitationsService.revokeInvitation(invitationId);
  }
}

/** Accepting an invitation needs a signed-in user but no membership yet. */
@Controller('invitations')
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Post('accept')
  @HttpCode(HttpStatus.OK)
  accept(
    @Body(new ZodValidationPipe(acceptInvitationRequestSchema)) body: AcceptInvitationRequest,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ slug: string }> {
    return this.invitationsService.accept(body, user.id, user.email);
  }
}
