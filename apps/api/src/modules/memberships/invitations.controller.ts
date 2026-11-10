import { Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import type { AcceptInvitationResponse } from '@event-platform/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { InvitationsService } from './invitations.service';

/**
 * Accepting an invitation.
 *
 * Authenticated (no `@Public`) because the invitation is bound to the account email,
 * but not tenant-scoped: the workspace is discovered from the invitation itself, never
 * from the URL.
 */
@Controller('auth/invitations')
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Post(':token/accept')
  @HttpCode(HttpStatus.OK)
  accept(
    @Param('token') token: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AcceptInvitationResponse> {
    return this.invitations.accept(token, user.id);
  }
}
