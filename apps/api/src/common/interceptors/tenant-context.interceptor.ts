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

    if (!tenant || !user) {
      return next.handle();
    }

    const store = {
      organizationId: tenant.organizationId,
      userId: user.id,
      membershipId: tenant.membershipId,
      permissions: tenant.permissions,
      requestId: request.requestId,
      ipAddress: request.ip,
    };

    return new Observable((subscriber) =>
      this.tenantContext.run(store, () => {
        next.handle().subscribe(subscriber);
      }),
    );
  }
}
