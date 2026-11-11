import type { ConsentRequirement } from '@event-platform/shared';

/**
 * Consent versioning, as pure functions (R11).
 *
 * Only the highest published version of a key is required. A record snapshots the key
 * and version it accepted, so publishing a new version never rewrites history.
 */

export interface PublishedDocument {
  id: string;
  key: string;
  version: number;
  title: string;
  body: string;
  required: boolean;
  publishedAt: Date | null;
}

export interface AcceptedConsent {
  key: string;
  version: number;
}

/** Requirement plus the document row id, used when writing a record. */
export interface ConsentRequirementRecord extends ConsentRequirement {
  id: string;
}

export function latestPublishedVersions<T extends PublishedDocument>(
  documents: readonly T[],
): T[] {
  const byKey = new Map<string, T>();

  for (const document of documents) {
    if (!document.publishedAt) {
      continue;
    }

    const current = byKey.get(document.key);
    if (!current || document.version > current.version) {
      byKey.set(document.key, document);
    }
  }

  return [...byKey.values()].sort((left, right) => left.key.localeCompare(right.key));
}

export function toRequirementRecords(
  documents: readonly PublishedDocument[],
): ConsentRequirementRecord[] {
  return latestPublishedVersions(documents).map((document) => ({
    id: document.id,
    key: document.key,
    version: document.version,
    title: document.title,
    body: document.body,
    required: document.required,
  }));
}

/** Requirements the participant did not accept at their current version. */
export function missingRequiredConsents(
  requirements: readonly ConsentRequirement[],
  accepted: readonly AcceptedConsent[],
): ConsentRequirement[] {
  const acceptedVersion = new Map(
    accepted.map((consent) => [consent.key, consent.version]),
  );

  return requirements.filter(
    (requirement) =>
      requirement.required &&
      acceptedVersion.get(requirement.key) !== requirement.version,
  );
}

/** Accepted entries that match a published requirement at that exact version. */
export function matchedAcceptances<T extends ConsentRequirement>(
  requirements: readonly T[],
  accepted: readonly AcceptedConsent[],
): T[] {
  const byKey = new Map(requirements.map((requirement) => [requirement.key, requirement]));

  return accepted.flatMap((consent) => {
    const requirement = byKey.get(consent.key);
    return requirement && requirement.version === consent.version ? [requirement] : [];
  });
}
