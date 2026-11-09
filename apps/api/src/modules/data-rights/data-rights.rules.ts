import { randomUUID } from 'node:crypto';

/** What a person's identifying fields become when their data is erased. */
export function anonymisedPerson(personId: string): {
  email: string;
  firstName: string;
  lastName: string;
  phone: null;
} {
  return {
    // Unique per person so the (organisation, e-mail) constraint still holds, and not a
    // deliverable address.
    email: `erased-${personId}@erased.invalid`,
    firstName: '[erased]',
    lastName: '[erased]',
    phone: null,
  };
}

/** Data is kept until `months` after the end of the last event the person registered for. */
export function retentionCutoff(now: Date, months: number): Date {
  const cutoff = new Date(now);
  // Setting the month first would overflow at month ends (31 March minus one month is not
  // "31 February"); clamp the day to the length of the target month instead.
  const day = cutoff.getUTCDate();
  cutoff.setUTCDate(1);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - months);
  const lastDay = new Date(Date.UTC(cutoff.getUTCFullYear(), cutoff.getUTCMonth() + 1, 0)).getUTCDate();
  cutoff.setUTCDate(Math.min(day, lastDay));
  return cutoff;
}

/** A fresh unusable credential hash, so an erased registration's portal link stops working. */
export function deadCredentialHash(): string {
  return `erased-${randomUUID()}`;
}
