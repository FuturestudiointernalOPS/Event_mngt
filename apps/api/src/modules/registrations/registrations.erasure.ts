/**
 * What a person's identifying fields become when their data is erased.
 *
 * The registration and check-in rows stay, so counts, reports and badges issued remain
 * correct; only the link to a real human is destroyed. The replacement address is unique
 * per person (the organisation/e-mail constraint still has to hold) and is not a
 * deliverable domain.
 */
export interface ErasedPersonFields {
  email: string;
  firstName: string;
  lastName: string;
  phone: null;
  organizationName: null;
  jobTitle: null;
  country: null;
}

export function erasedPerson(personId: string): ErasedPersonFields {
  return {
    email: `erased-${personId}@erased.invalid`,
    firstName: '[erased]',
    lastName: '[erased]',
    phone: null,
    organizationName: null,
    jobTitle: null,
    country: null,
  };
}

/** True once a person row carries the anonymised address. */
export function isErasedEmail(email: string): boolean {
  return email.endsWith('@erased.invalid');
}
