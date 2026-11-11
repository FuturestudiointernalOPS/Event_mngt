import type { RegistrationWindow } from '@event-platform/shared';
import { slugify } from '../../common/utils/slug';

/**
 * Form and window arithmetic, kept pure so it can be tested without a database (R11).
 */

export interface WindowInput {
  registrationOpensAt: Date | null;
  registrationClosesAt: Date | null;
}

/** A window with neither bound is always open; each bound is inclusive. */
export function windowState(input: WindowInput, now: Date = new Date()): RegistrationWindow {
  const opensAt = input.registrationOpensAt;
  const closesAt = input.registrationClosesAt;

  const afterOpen = opensAt === null || now.getTime() >= opensAt.getTime();
  const beforeClose = closesAt === null || now.getTime() <= closesAt.getTime();

  return {
    opensAt: opensAt ? opensAt.toISOString() : null,
    closesAt: closesAt ? closesAt.toISOString() : null,
    isOpen: afterOpen && beforeClose,
  };
}

/** A key the shared keySchema accepts, derived from a free-text category name. */
export function categoryKeyBase(name: string): string {
  const base = slugify(name, 40);

  return base.length >= 2 ? base : 'category';
}

/**
 * Appends -2, -3, … until the key is free. Category keys are unique per event, and a
 * silent overwrite would reclassify existing registrations.
 */
export function nextAvailableKey(base: string, taken: readonly string[]): string {
  if (!taken.includes(base)) {
    return base;
  }

  let suffix = 2;
  while (taken.includes(`${base}-${suffix}`)) {
    suffix += 1;
  }

  return `${base}-${suffix}`;
}
