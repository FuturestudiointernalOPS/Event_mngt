import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AcceptInvitationRequest,
  InviteMemberRequest,
  Invitation,
} from '@event-platform/shared';
import { writeAudit } from '../../common/audit/audit';
import { AppException } from '../../common/app-exception';
import { generateOpaqueToken, hashOpaqueToken } from '../../common/utils/tokens';
import type { Env } from '../../config/env.validation';
import { MemberStatus } from '../../database/prisma-client';
import { PrismaService } from '../../database/prisma.service';
import { TenantTransactionService } from '../../database/tenant-transaction.service';
import { EMAIL_PORT } from '../../integrations/email/email.port';
import type { EmailPort } from '../../integrations/email/email.port';
import { INVITATION_TTL_DAYS, assertInvitationUsable } from './team.rules';

/** Invitations: issue, list, revoke and accept. */
@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantTransaction: TenantTransactionService,
    private readonly config: ConfigService<Env, true>,
    @Inject(EMAIL_PORT) private readonly email: EmailPort,
  ) {}

  listInvitations(): Promise<Invitation[]> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const rows = await tx.organizationInvitation.findMany({
        where: { organizationId: tenant.organizationId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          expiresAt: true,
          acceptedAt: true,
          revokedAt: true,
          createdAt: true,
          role: { select: { key: true } },
        },
      });
      return rows.map((row) => ({
        id: row.id,
        email: row.email,
        roleKey: row.role.key,
        expiresAt: row.expiresAt.toISOString(),
        acceptedAt: row.acceptedAt ? row.acceptedAt.toISOString() : null,
        revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
        createdAt: row.createdAt.toISOString(),
      }));
    });
  }

  async invite(input: InviteMemberRequest, invitedByUserId: string): Promise<Invitation> {
    const token = generateOpaqueToken();

    const { invitation, workspaceSlug, workspaceName } = await this.tenantTransaction.withTenant(
      async (tx, tenant) => {
        const role = await tx.organizationRole.findFirst({
          where: { organizationId: tenant.organizationId, key: input.roleKey },
          select: { id: true, key: true },
        });

        if (!role) {
          throw AppException.badRequest('invalid_role', 'This role does not exist.');
        }

        const existing = await tx.organizationMember.findFirst({
          where: { organizationId: tenant.organizationId, user: { email: input.email } },
          select: { id: true },
        });

        if (existing) {
          throw AppException.conflict('already_member', 'This person is already on the team.');
        }

        // A new invitation replaces any pending one for the same address.
        await tx.organizationInvitation.updateMany({
          where: {
            organizationId: tenant.organizationId,
            email: input.email,
            acceptedAt: null,
            revokedAt: null,
          },
          data: { revokedAt: new Date() },
        });

        const row = await tx.organizationInvitation.create({
          data: {
            organizationId: tenant.organizationId,
            email: input.email,
            roleId: role.id,
            tokenHash: hashOpaqueToken(token),
            invitedByUserId,
            expiresAt: new Date(Date.now() + INVITATION_TTL_DAYS * 86_400_000),
          },
        });

        const organization = await tx.organization.findUniqueOrThrow({
          where: { id: tenant.organizationId },
          select: { slug: true, name: true },
        });

        await writeAudit(tx, {
          organizationId: tenant.organizationId,
          actorUserId: invitedByUserId,
          action: 'invitation.created',
          targetType: 'team',
          targetId: row.id,
        });

        return {
          invitation: {
            id: row.id,
            email: row.email,
            roleKey: role.key,
            expiresAt: row.expiresAt.toISOString(),
            acceptedAt: null,
            revokedAt: null,
            createdAt: row.createdAt.toISOString(),
          },
          workspaceSlug: organization.slug,
          workspaceName: organization.name,
        };
      },
    );

    const link = `${this.config.get('WEB_APP_URL', { infer: true })}/join?workspace=${workspaceSlug}&token=${token}`;

    await this.email.send({
      to: input.email,
      subject: `You are invited to ${workspaceName}`,
      text: [
        `You have been invited to join ${workspaceName} on the Event Platform.`,
        '',
        'Sign in (or create an account with this email address), then open:',
        link,
        '',
        `This invitation expires in ${INVITATION_TTL_DAYS} days.`,
      ].join('\n'),
    });

    return invitation;
  }

  revokeInvitation(invitationId: string): Promise<void> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const result = await tx.organizationInvitation.updateMany({
        where: {
          id: invitationId,
          organizationId: tenant.organizationId,
          acceptedAt: null,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });

      if (result.count === 0) {
        throw AppException.notFound('not_found', 'Invitation not found.');
      }
    });
  }

  /**
   * Accepting runs without a membership, so the organisation comes from the public
   * workspace slug and the invitation is proven by its secret token and the signed-in
   * email address, never by anything the client merely asserts.
   */
  async accept(input: AcceptInvitationRequest, userId: string, userEmail: string): Promise<{ slug: string }> {
    const organization = await this.prisma.organization.findUnique({
      where: { slug: input.workspaceSlug },
      select: { id: true, slug: true },
    });

    if (!organization) {
      throw AppException.notFound('invitation_invalid', 'This invitation is invalid or has expired.');
    }

    return this.tenantTransaction.withOrganization(organization.id, userId, async (tx) => {
      const invitation = await tx.organizationInvitation.findFirst({
        where: { organizationId: organization.id, tokenHash: hashOpaqueToken(input.token) },
      });

      assertInvitationUsable(invitation, userEmail, new Date());

      if (!invitation) {
        throw AppException.notFound('invitation_invalid', 'This invitation is invalid or has expired.');
      }

      await tx.organizationMember.upsert({
        where: { organizationId_userId: { organizationId: organization.id, userId } },
        create: {
          organizationId: organization.id,
          userId,
          roleId: invitation.roleId,
          status: MemberStatus.ACTIVE,
          invitedByUserId: invitation.invitedByUserId,
          joinedAt: new Date(),
        },
        update: { roleId: invitation.roleId, status: MemberStatus.ACTIVE },
      });

      await tx.organizationInvitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      });

      return { slug: organization.slug };
    });
  }
}
