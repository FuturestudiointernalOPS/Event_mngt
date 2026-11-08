import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { ApiMeta } from '@event-platform/shared';
import { map, Observable } from 'rxjs';
import type { AuthenticatedRequest } from '../types/authenticated-request';
import type { PaginatedResult } from '../types/authenticated-user';

export interface ApiEnvelope<T> {
  data: T;
  meta: ApiMeta;
}

/**
 * Wraps every successful response in `{ data, meta }` and translates a paginated
 * service result into `meta.pagination`. Services return domain objects, not HTTP
 * envelopes — the shape lives in exactly one place.
 *
 * See docs/07-api-conventions.md.
 */
@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    return next.handle().pipe(
      map((payload: unknown) => {
        // 204 No Content and explicitly empty responses stay empty.
        if (payload === undefined || payload === null) {
          return payload;
        }

        const baseMeta: ApiMeta = {
          requestId: request.requestId ?? 'unknown',
          timestamp: new Date().toISOString(),
        };

        if (isPaginated(payload)) {
          const totalPages = payload.pageSize > 0 ? Math.ceil(payload.total / payload.pageSize) : 0;
          return {
            data: payload.items,
            meta: {
              ...baseMeta,
              pagination: {
                page: payload.page,
                pageSize: payload.pageSize,
                total: payload.total,
                totalPages,
              },
            },
          };
        }

        return { data: payload, meta: baseMeta };
      }),
    );
  }
}

function isPaginated(value: unknown): value is PaginatedResult<unknown> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Partial<PaginatedResult<unknown>>;
  return (
    Array.isArray(candidate.items) &&
    typeof candidate.page === 'number' &&
    typeof candidate.pageSize === 'number' &&
    typeof candidate.total === 'number'
  );
}
