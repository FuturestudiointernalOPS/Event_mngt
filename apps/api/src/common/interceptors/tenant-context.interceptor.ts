import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { TenantContextService } from '../../database/tenant-context.service';
import type { AuthenticatedRequest } from '../types/authenticated-request';

/**
 * Binds the resolved tenant to the async scope of the request so every service and
 * repository downstream can read it through TenantContextService.
 *
 * The handler is subscribed inside `run()`: an Observable is lazy, so subscribing
 * outside the scope would leave the pipeline without tenant context.
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  constructor(private readonly tenantContext: TenantContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const tenant = request.tenant;
    const user = request.user;
    const participant = request.participant;

    if (!participant && (!tenant || !user)) {
      return next.handle();
    }

    // A participant acts inside their organisation with no staff identity and no staff
    // permissions: services read `organizationId` and the participant decorator only.
    const store = participant
      ? { organizationId: participant.organizationId, userId: '', membershipId: '', permissions: [] }
      : {
          organizationId: tenant!.organizationId,
          userId: user!.id,
          membershipId: tenant!.membershipId,
          permissions: tenant!.permissions,
        };

    return new Observable((subscriber) =>
      this.tenantContext.run(store, () => {
        next.handle().subscribe(subscriber);
      }),
    );
  }
}
