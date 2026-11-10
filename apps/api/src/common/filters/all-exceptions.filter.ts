import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../types/authenticated-request';
import { normalizeException } from './error-normalizer';

/**
 * Single exit point for errors. Produces the documented envelope:
 *   { error: { code, message, details? }, meta: { requestId, timestamp } }
 *
 * Never leaks stack traces, SQL or another tenant's identifiers to the client.
 * The mapping itself lives in error-normalizer so it can be tested directly.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<AuthenticatedRequest>();
    const requestId = request.requestId ?? 'unknown';
    const timestamp = new Date().toISOString();
    const normalized = normalizeException(exception);

    if (normalized.status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `[${requestId}] ${request.method} ${request.originalUrl} -> ${normalized.status} ${normalized.code}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(
        `[${requestId}] ${request.method} ${request.originalUrl} -> ${normalized.status} ${normalized.code}`,
      );
    }

    if (normalized.headers) {
      for (const [name, value] of Object.entries(normalized.headers)) {
        response.setHeader(name, value);
      }
    }

    response.status(normalized.status).json({
      error: {
        code: normalized.code,
        message: normalized.message,
        ...(normalized.details === undefined ? {} : { details: normalized.details }),
      },
      meta: { requestId, timestamp },
    });
  }
}
