import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { IDEMPOTENCY_KEY_HEADER } from '@event-platform/shared';
import type { Request, Response } from 'express';
import {
  catchError,
  concatMap,
  from,
  mergeMap,
  of,
  switchMap,
  throwError,
  type Observable,
} from 'rxjs';
import { AppException } from '../app-exception';
import { TenantContextService } from '../../database/tenant-context.service';
import type { AuthenticatedRequest } from '../types/authenticated-request';
import { IDEMPOTENT_KEY } from './idempotency.decorator';
import { hashRequestPayload } from './idempotency.hash';
import { idempotencyScope } from './idempotency.scope';
import {
  IdempotencyService,
  type BeginIdempotencyInput,
} from './idempotency.service';

const MAX_KEY_LENGTH = 200;

/**
 * Runs an opted-in state-changing handler at most once per Idempotency-Key.
 *
 * A pending row is stored before the handler runs, so a concurrent replay is refused
 * with `idempotency_in_progress` instead of duplicating the side effect. A failed
 * handler removes its pending row and can be retried.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly idempotency: IdempotencyService,
    private readonly tenantContext: TenantContextService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const enabled = this.reflector.getAllAndOverride<boolean>(IDEMPOTENT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!enabled) {
      return next.handle();
    }

    const http = context.switchToHttp();
    const request = http.getRequest<AuthenticatedRequest>();
    const response = http.getResponse<Response>();
    const rawKey = request.headers[IDEMPOTENCY_KEY_HEADER];

    if (rawKey === undefined) {
      return next.handle();
    }

    if (typeof rawKey !== 'string' || rawKey.length === 0 || rawKey.length > MAX_KEY_LENGTH) {
      throw AppException.badRequest(
        'invalid_idempotency_key',
        `Send an Idempotency-Key header of at most ${MAX_KEY_LENGTH} characters.`,
      );
    }

    const tenant = this.tenantContext.get();
    const input: BeginIdempotencyInput = {
      scope: idempotencyScope(request, tenant),
      key: rawKey,
      requestHash: hashRequestPayload({ body: request.body, query: request.query }),
      organizationId: tenant?.organizationId ?? null,
    };

    return from(this.idempotency.begin(input)).pipe(
      switchMap((result) => {
        if (result.kind === 'replay') {
          response.status(result.status);
          return of(result.body);
        }

        if (result.kind === 'conflict') {
          throw AppException.conflict(
            'idempotency_conflict',
            'This Idempotency-Key was already used with a different request.',
          );
        }

        if (result.kind === 'in_progress') {
          throw AppException.conflict(
            'idempotency_in_progress',
            'This request is still being processed. Retry in a moment.',
          );
        }

        let handlerSucceeded = false;

        return next.handle().pipe(
          concatMap(async (body) => {
            handlerSucceeded = true;

            try {
              await this.idempotency.complete(input, successStatus(context, request), body);
            } catch (error) {
              // The side effect happened; failing the response would invite a retry.
              // The pending row stays, so a retry is refused rather than duplicated.
              this.logger.warn(
                `Could not store the idempotent response for ${request.method} ${request.originalUrl}: ${
                  error instanceof Error ? error.message : String(error)
                }`,
              );
            }

            return body;
          }),
          catchError((error) => {
            if (handlerSucceeded) {
              return throwError(() => error);
            }

            return from(this.idempotency.abandon(input)).pipe(
              mergeMap(() => throwError(() => error)),
            );
          }),
        );
      }),
    );
  }
}

/** Mirrors Nest's default status for the decorated handler. */
function successStatus(context: ExecutionContext, request: Request): number {
  const explicit = Reflect.getMetadata(HTTP_CODE_METADATA, context.getHandler());

  if (typeof explicit === 'number') {
    return explicit;
  }

  return request.method === 'POST' ? 201 : 200;
}
