import { Prisma } from '../../database/prisma-client';
import { AppException } from '../app-exception';

/**
 * URL-safe slug for event and workspace identifiers.
 * Accents are folded so French titles produce usable slugs.
 */
export function slugify(value: string, maxLength = 60): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '');
}

/**
 * Appends -2, -3, ... until the slug is free. `exists` performs the lookup.
 * `fallback` is used when the base contains no slug-able characters.
 */
export async function ensureUniqueSlug(
  base: string,
  exists: (candidate: string) => Promise<boolean>,
  fallback = 'event',
): Promise<string> {
  const root = slugify(base) || fallback;
  let candidate = root;
  let suffix = 2;

  while (await exists(candidate)) {
    candidate = `${root}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

/**
 * True when the database refused a write because a unique column is taken. The only
 * unique column this module protects is the public slug.
 */
export function isSlugConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

/**
 * Turn a unique-violation on the slug into the same conflict the pre-check raises, then
 * rethrow anything else untouched.
 *
 * The index matters because the public address is the slug alone: a slug owned by
 * another workspace is invisible to the tenant-scoped pre-check under row-level
 * security, so the database is the only place that can refuse it. Returning `never`
 * lets callers put this straight in a catch block.
 */
export function throwIfSlugConflict(error: unknown): never {
  if (isSlugConflict(error)) {
    throw AppException.conflict(
      'slug_taken',
      'This web address is already used by another event. Choose a different one.',
    );
  }

  throw error;
}
