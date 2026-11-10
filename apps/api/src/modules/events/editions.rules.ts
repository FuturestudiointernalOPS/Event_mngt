import { AppException } from '../../common/app-exception';

/**
 * Edition rules, as pure functions (R11).
 *
 * Depth is one: a parent may have editions, an edition may not itself have editions.
 * Everything else (slug uniqueness, publishing) reuses the event rules unchanged.
 */
export interface EditionParent {
  parentEventId: string | null;
}

export function assertCanBeParent(parent: EditionParent): void {
  if (parent.parentEventId) {
    throw AppException.badRequest(
      'invalid_reference',
      'An edition cannot itself have editions.',
    );
  }
}
