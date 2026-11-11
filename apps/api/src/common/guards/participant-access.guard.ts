import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { parseParticipantCredential } from '@event-platform/shared';
import { TenantTransactionService } from '../../database/tenant-transaction.service';
import { hashBadgeToken } from '../../modules/badges/badge.tokens';
import { AppException } from '../app-exception';
import { PARTICIPANT_SCOPE_KEY } from '../decorators/participant-scoped.decorator';
import type { AuthenticatedRequest } from '../types/authenticated-request';

export const PARTICIPANT_CREDENTIAL_HEADER = 'x-participant-credential';

const REFUSAL = () =>
  AppException.unauthorized('participant_credential_invalid', 'Open the link from your e-mail again.');

/**
 * Authenticates the participant space from the credential in the e-mailed link.
 *
 * R7: the organisation id inside the credential is only a routing hint. The badge is looked
 * up INSIDE that organisation's scope and its stored hash must match the secret, so a
 * forged organisation id finds nothing. Reissuing or revoking the badge, or a registration
 * that is no longer approved, ends access immediately.
 */
@Injectable()
export class ParticipantAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tenantTransaction: TenantTransactionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const scoped = this.reflector.getAllAndOverride<boolean>(PARTICIPANT_SCOPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!scoped) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers[PARTICIPANT_CREDENTIAL_HEADER];
    const credential = typeof header === 'string' ? parseParticipantCredential(header) : null;

    if (!credential) {
      throw REFUSAL();
    }

    const badge = await this.tenantTransaction.withOrganizationScope(
      credential.organizationId,
      (tx) =>
        tx.badge.findFirst({
          where: {
            organizationId: credential.organizationId,
            registrationId: credential.registrationId,
            tokenHash: hashBadgeToken(credential.token),
            status: 'ISSUED',
            registration: { status: 'APPROVED' },
          },
          select: { eventId: true, registration: { select: { reference: true } } },
        }),
    );

    if (!badge) {
      throw REFUSAL();
    }

    request.participant = {
      organizationId: credential.organizationId,
      registrationId: credential.registrationId,
      eventId: badge.eventId,
      badgeReference: badge.registration.reference,
      badgeToken: credential.token,
    };

    return true;
  }
}
