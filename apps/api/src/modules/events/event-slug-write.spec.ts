import { describe, expect, it } from 'vitest';
import { Prisma } from '../../database/prisma-client';
import { createWithFreeSlug } from './event-slug-write';
import type { EventWithModules } from './events.mapper';

function uniqueViolation(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '7.10.1',
  });
}

const row = { id: 'e1' } as EventWithModules;

describe('createWithFreeSlug', () => {
  it('keeps the generated slug when nothing is in the way', async () => {
    const attempts: string[] = [];

    const created = await createWithFreeSlug(async (slug) => {
      attempts.push(slug);
      return row;
    }, 'village-2026');

    expect(attempts).toEqual(['village-2026']);
    expect(created).toBe(row);
  });

  it('retries with a random suffix when another workspace already owns the slug', async () => {
    const attempts: string[] = [];

    const created = await createWithFreeSlug(async (slug) => {
      attempts.push(slug);

      if (attempts.length === 1) {
        throw uniqueViolation();
      }

      return row;
    }, 'village-2026');

    expect(attempts).toHaveLength(2);
    expect(attempts[1]).toMatch(/^village-2026-[0-9a-f]{6}$/);
    expect(created).toBe(row);
  });

  it('does not retry when the failure is something else', async () => {
    const attempts: string[] = [];

    await expect(
      createWithFreeSlug(async (slug) => {
        attempts.push(slug);
        throw new Error('database is down');
      }, 'village-2026'),
    ).rejects.toThrow('database is down');

    expect(attempts).toHaveLength(1);
  });
});
