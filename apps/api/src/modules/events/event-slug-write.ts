import { randomBytes } from 'node:crypto';
import { isSlugConflict } from '../../common/utils/slug';
import type { EventWithModules } from './events.mapper';

/**
 * Create a row whose slug was generated for the user, retrying once with a random suffix
 * when that slug is already taken by another workspace.
 *
 * The tenant-scoped pre-check cannot see other tenants under row-level security, so the
 * unique index is the only authority. Retrying keeps "create" and "duplicate" working
 * without asking the user to invent a slug — but it is only correct for slugs the user
 * never saw. A slug they typed is refused instead, so their choice is never overwritten.
 */
export async function createWithFreeSlug(
  create: (slug: string) => Promise<EventWithModules>,
  slug: string,
): Promise<EventWithModules> {
  try {
    return await create(slug);
  } catch (error) {
    if (!isSlugConflict(error)) {
      throw error;
    }

    return create(`${slug}-${randomBytes(3).toString('hex')}`);
  }
}
