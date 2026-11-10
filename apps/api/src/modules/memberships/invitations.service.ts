import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  AcceptInvitationResponse,
  InvitationSummary,
  InviteMemberRequest,
} from '@event-platform/shared';
import { AppException } from '../../common/app-exception';
import { AUDIT_ACTIONS } from '../../common/audit/audit.actions';
import { AuditService } from '../../common/audit/audit.service';
import { generateOpaqueToken, hashOpaqueToken } from '../../common/utils/tokens';
import type { Env } from '../../config/env.validation';
import { TenantTransactionService } from '../../database/tenant-transaction.service';
import { EMAIL_PORT } from '../../integrations/email/email.port';
import type { EmailPort } from '../../integrations/email/email.port';
import { MembershipsRepository } from './memberships.repository';
import { assertInvitationUsable, invalidInvitation } from './memberships.rules';

const INVITATION_TTL_DAYS = 7;

/**
 * Inviting somebody and accepting an invitation.
 *
 * The token is a bearer credential, so only its hash is stored. Every rejection shares
 * one code and one message: existence, expiry and a mismatched address are
 * indistinguishable from the outside.
 */
@Injectable()
export class InvitationsService {
  constructor(
    private readonly tenantTransaction: TenantTransactionService,
    private readonly repository: MembershipsRepository,
    private readonly audit: AuditService,
    private readonly config: ConfigService<Env, true>,
    @Inject(EMAIL_PORT) private readonly email: EmailPort,
  ) {}

  async invite(input: InviteMemberRequest): Promise<InvitationSummary> {
    const token = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 86_400_000);

    const created = await this.tenantTransaction.withTenant(async (tx, tenant) => {
      const role = await this.repository.findRole(tx, tenant.organizationId, input.roleId);

      if (!role) {
        throw AppException.badRequest(
          'invalid_reference',
          'That role does not exist in this workspace.',
        );
      }

      const existingUser = await this.repository.findUserByEmail(input.email);

      if (existingUser) {
        const membership = await this.repository.findMembershipForUser(
          tx,
          tenant.organizationId,
          existingUser.id,
        );

        if (membership) {
          throw AppException.conflict(
            'member_exists',
            'That person is already a member of this workspace.',
          );
        }
      }

      const pending = await this.repository.findPendingInvitation(
        tx,
        tenant.organizationId,
        input.email,
      );

      if (pending) {
        throw AppException.conflict(
          'invitation_pending',
          'An invitation is already pending for that address.',
        );
      }

      return this.repository.createInvitation(tx, {
        organizationId: tenant.organizationId,
        email: input.email,
        roleId: role.id,
        tokenHash: hashOpaqueToken(token),
        invitedByUserId: tenant.userId,
        expiresAt,
      });
    });

    await this.audit.record({
      action: AUDIT_ACTIONS.memberInvited,
      targetType: 'invitation',
      targetId: created.id,
      metadata: { email: created.email, role: created.role.key },
    });

    const url = `${this.config.get('WEB_APP_URL', { infer: true })}/accept-invitation?token=${token}`;

    await this.email.send({
      to: created.email,
      subject: 'You have been invited to a workspace',
      text: [
        'You have been invited to join a workspace on the Event Platform.',
        '',
        'Accept the invitation:',
        url,
        '',
        `This link can be used once and expires in ${INVITATION_TTL_DAYS} days.`,
        'If you were not expecting this, no action is required.',
      ].join('\n'),
    });

    return {
      id: created.id,
      email: created.email,
      roleKey: created.role.key,
      expiresAt: created.expiresAt.toISOString(),
    };
  }

  /**
   * Two steps: the invitation is read in the user scope (an invited address can read
   * only its own), then consumed and turned into a membership in the organisation
   * scope. Consumption is a conditional update, so a concurrent accept cannot create
   * two memberships.
   */
  async accept(token: string, userId: string): Promise<AcceptInvitationResponse> {
    const tokenHash = hashOpaqueToken(token);

    const located = await this.tenantTransaction.withUserScope(userId, async (tx) => {
      const account = await tx.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });

      if (!account) {
        throw AppException.unauthorized('unauthorized', 'Sign in to continue.');
      }

      const invitation = await this.repository.findInvitationByToken(tx, tokenHash);

      if (!invitation) {
        throw invalidInvitation();
      }

      assertInvitationUsable(invitation, account.email);

      const existing = await this.repository.findMembershipForUser(
        tx,
        invitation.organizationId,
        userId,
      );

      if (existing) {
        throw AppException.conflict(
          'member_exists',
          'You are already a member of this workspace.',
        );
      }

      return invitation;
    });

    return this.tenantTransaction.withOrganizationScope(located.organizationId, async (tx) => {
      const consumed = await this.repository.consumeInvitation(tx, located.id);

      if (consumed === 0) {
        throw invalidInvitation();
      }

      await this.repository.createMembership(tx, {
        organizationId: located.organizationId,
        userId,
        roleId: located.roleId,
      });

      const organization = await tx.organization.findUnique({
        where: { id: located.organizationId },
        select: { id: true, slug: true, name: true },
      });

      if (!organization) {
        throw AppException.notFound('tenant_not_found', 'Workspace not found.');
      }

      return {
        organizationId: organization.id,
        organizationSlug: organization.slug,
        organizationName: organization.name,
      };
    });
  }
}
