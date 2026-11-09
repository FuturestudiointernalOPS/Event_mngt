import { randomBytes } from 'node:crypto';

/** True for a PostgreSQL unique-constraint violation surfaced by Prisma (P2002). */
export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

/** Short lowercase suffix for de-duplicating generated slugs. */
export function randomSuffix(length = 4): string {
  return randomBytes(length).toString('hex').slice(0, length);
}
