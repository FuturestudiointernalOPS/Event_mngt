import { HttpException, HttpStatus } from '@nestjs/common';
import { Prisma } from '../../database/prisma-client';
import { AppException } from '../app-exception';

export interface NormalizedError {
  status: number;
  code: string;
  message: string;
  details?: unknown;
}

/**
 * Turns anything thrown into the documented error envelope.
 *
 * Extracted from the filter so it can be tested without an HTTP host, which is how
 * the "database unreachable" behaviour stays a regression test rather than a memory.
 */
export function normalizeException(exception: unknown): NormalizedError {
  if (exception instanceof AppException) {
    return {
      status: exception.getStatus(),
      code: exception.code,
      message: exception.message,
      details: exception.details,
    };
  }

  if (exception instanceof HttpException) {
    return fromHttpException(exception);
  }

  if (exception instanceof Prisma.PrismaClientKnownRequestError) {
    return fromPrismaError(exception);
  }

  if (exception instanceof Prisma.PrismaClientInitializationError) {
    return {
      status: HttpStatus.SERVICE_UNAVAILABLE,
      code: 'database_unreachable',
      message:
        'The database is not reachable. Check DATABASE_URL and that the server is running.',
    };
  }

  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    code: 'internal_error',
    message: 'Something went wrong. Please try again.',
  };
}

function fromHttpException(exception: HttpException): NormalizedError {
  const status = exception.getStatus();
  const body = exception.getResponse();

  if (typeof body === 'string') {
    return { status, code: defaultCode(status), message: body };
  }

  const record = body as Record<string, unknown>;
  const code = typeof record.code === 'string' ? record.code : defaultCode(status);
  const message = typeof record.message === 'string' ? record.message : exception.message;
  const details = record.details ?? (Array.isArray(record.message) ? record.message : undefined);

  return { status, code, message, details };
}

function fromPrismaError(exception: Prisma.PrismaClientKnownRequestError): NormalizedError {
  switch (exception.code) {
    case 'P2002':
      return {
        status: HttpStatus.CONFLICT,
        code: 'conflict',
        message: 'That record already exists.',
      };
    case 'P2025':
      return {
        status: HttpStatus.NOT_FOUND,
        code: 'not_found',
        message: 'The requested record was not found.',
      };
    case 'P2003':
      return {
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        code: 'invalid_reference',
        message: 'A related record is missing or not accessible.',
      };
    default:
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        code: 'internal_error',
        message: 'A database error occurred.',
      };
  }
}

function defaultCode(status: number): string {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return 'validation_error';
    case HttpStatus.UNAUTHORIZED:
      return 'unauthorized';
    case HttpStatus.FORBIDDEN:
      return 'forbidden';
    case HttpStatus.NOT_FOUND:
      return 'not_found';
    case HttpStatus.CONFLICT:
      return 'conflict';
    case HttpStatus.UNPROCESSABLE_ENTITY:
      return 'unprocessable';
    case HttpStatus.TOO_MANY_REQUESTS:
      return 'rate_limited';
    case HttpStatus.SERVICE_UNAVAILABLE:
      return 'service_unavailable';
    default:
      return 'internal_error';
  }
}
