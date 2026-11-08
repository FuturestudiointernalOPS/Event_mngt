import { Injectable, NestMiddleware } from '@nestjs/common';
import { REQUEST_ID_HEADER } from '@event-platform/shared';
import type { NextFunction, Response } from 'express';
import { randomUUID } from 'node:crypto';
import type { AuthenticatedRequest } from '../types/authenticated-request';

/**
 * Correlates logs, audit entries and client-visible error payloads.
 * Honours an inbound X-Request-Id when it is reasonable, otherwise generates one.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(request: AuthenticatedRequest, response: Response, next: NextFunction): void {
    const raw = request.headers[REQUEST_ID_HEADER];
    const incoming = Array.isArray(raw) ? raw[0] : raw;
    const candidate = typeof incoming === 'string' ? incoming.trim() : '';

    request.requestId =
      candidate.length > 0 && candidate.length <= 128 ? candidate : randomUUID();

    response.setHeader('X-Request-Id', request.requestId);
    next();
  }
}
