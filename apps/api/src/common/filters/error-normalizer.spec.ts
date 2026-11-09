import { HttpException, HttpStatus } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { Prisma } from '../../database/prisma-client';
import { AppException } from '../app-exception';
import { normalizeException } from './error-normalizer';

describe('normalizeException', () => {
  it('keeps the application error code and details', () => {
    const normalized = normalizeException(
      AppException.conflict('slug_taken', 'That address is taken.', { field: 'slug' }),
    );

    expect(normalized).toEqual({
      status: HttpStatus.CONFLICT,
      code: 'slug_taken',
      message: 'That address is taken.',
      details: { field: 'slug' },
    });
  });

  it('derives a stable code from a framework exception without one', () => {
    const normalized = normalizeException(
      new HttpException('Slow down.', HttpStatus.TOO_MANY_REQUESTS),
    );

    expect(normalized).toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
      code: 'rate_limited',
      message: 'Slow down.',
    });
  });

  it('maps a duplicate record to a conflict', () => {
    const normalized = normalizeException(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '7.10.1',
      }),
    );

    expect(normalized).toMatchObject({ status: HttpStatus.CONFLICT, code: 'conflict' });
  });

  // Regression: an unreachable database used to surface as a generic server error.
  it('reports an unreachable database as unavailability', () => {
    const normalized = normalizeException(
      new Prisma.PrismaClientInitializationError('Can\'t reach database server', '7.10.1'),
    );

    expect(normalized).toMatchObject({
      status: HttpStatus.SERVICE_UNAVAILABLE,
      code: 'database_unreachable',
    });
  });

  it('never leaks an unexpected failure to the client', () => {
    const normalized = normalizeException(
      new Error('connect ECONNREFUSED 127.0.0.1:5432'),
    );

    expect(normalized.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(normalized.message).not.toContain('127.0.0.1');
  });
});
