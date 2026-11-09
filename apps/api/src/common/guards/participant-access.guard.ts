import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppException } from '../app-exception';
import { PARTICIPANT_SCOPE_KEY } from '../decorators/participant-scoped.decorator';
import type { AuthenticatedRequest } from '../types/authenticated-request';
import { parseAccessToken } from '../utils/badge';
import { hashOpaqueToken } from '../utils/tokens';
import { TenantTransactionService } from '../../database/tenant-transaction.service';

/**
 * Authenticates participant-portal routes from the e-mailed credential.
 *
 * R7 note: the organisation id inside the token is only a routing hint. Access is proven
 * by the secret: the registration is looked up INSIDE that organisation's scope and must
 * match the stored hash, so a forged organisation id simply finds nothing.
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
    const header = request.headers['x-participant-token'];
    const parsed = typeof header === 'string' ? parseAccessToken(header) : null;

    if (!parsed) {
      throw AppException.unauthorized('participant_token_invalid', 'Open the link from your e-mail again.');
    }

    const registration = await this.tenantTransaction.withOrganization(
      parsed.organizationId,
      null,
      (tx) =>
        tx.registration.findFirst({
          where: {
            id: parsed.registrationId,
            organizationId: parsed.organizationId,
            accessTokenHash: hashOpaqueToken(parsed.secret),
            status: { in: ['PENDING', 'CONFIRMED'] },
          },
          select: { id: true, eventId: true, status: true },
        }),
    );

    if (!registration) {
      throw AppException.unauthorized('participant_token_invalid', 'Open the link from your e-mail again.');
    }

    request.participant = {
      organizationId: parsed.organizationId,
      registrationId: registration.id,
      eventId: registration.eventId,
      status: registration.status,
    };

    return true;
  }
}
