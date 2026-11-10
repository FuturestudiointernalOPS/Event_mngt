import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Application exception carrying a stable, machine-readable error code.
 *
 * The response shape is produced by AllExceptionsFilter:
 *   { error: { code, message, details? }, meta: { requestId, timestamp } }
 *
 * See docs/07-api-conventions.md for the code vocabulary.
 */
export class AppException extends HttpException {
  constructor(
    status: HttpStatus,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
    /** Extra response headers, e.g. Retry-After on a rate-limit refusal. */
    public readonly headers?: Record<string, string>,
  ) {
    super({ code, message, details }, status);
  }

  static badRequest(code: string, message: string, details?: unknown): AppException {
    return new AppException(HttpStatus.BAD_REQUEST, code, message, details);
  }

  static unauthorized(code: string, message: string): AppException {
    return new AppException(HttpStatus.UNAUTHORIZED, code, message);
  }

  static forbidden(code: string, message: string, details?: unknown): AppException {
    return new AppException(HttpStatus.FORBIDDEN, code, message, details);
  }

  static notFound(code: string, message: string): AppException {
    return new AppException(HttpStatus.NOT_FOUND, code, message);
  }

  static gone(code: string, message: string): AppException {
    return new AppException(HttpStatus.GONE, code, message);
  }

  static conflict(code: string, message: string, details?: unknown): AppException {
    return new AppException(HttpStatus.CONFLICT, code, message, details);
  }

  static unprocessable(code: string, message: string, details?: unknown): AppException {
    return new AppException(HttpStatus.UNPROCESSABLE_ENTITY, code, message, details);
  }

  /** A server-side precondition failed; the public message stays generic. */
  static internal(code: string, message: string): AppException {
    return new AppException(HttpStatus.INTERNAL_SERVER_ERROR, code, message);
  }

  static tooManyRequests(
    code: string,
    message: string,
    retryAfterSeconds: number,
  ): AppException {
    return new AppException(
      HttpStatus.TOO_MANY_REQUESTS,
      code,
      message,
      undefined,
      { 'Retry-After': String(retryAfterSeconds) },
    );
  }
}
