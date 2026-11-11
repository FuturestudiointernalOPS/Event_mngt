import { describe, expect, it } from 'vitest';
import {
  latestPublishedVersions,
  matchedAcceptances,
  missingRequiredConsents,
  toRequirementRecords,
  type PublishedDocument,
} from './consent.versions';

function document(overrides: Partial<PublishedDocument>): PublishedDocument {
  return {
    id: 'doc-1',
    key: 'privacy',
    version: 1,
    title: 'Privacy',
    body: 'Text',
    required: true,
    publishedAt: new Date('2026-11-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('consent versioning', () => {
  it('requires only the highest published version of each key', () => {
    const documents = [
      document({ id: 'v1', version: 1 }),
      document({ id: 'v3', version: 3 }),
      document({ id: 'v2', version: 2 }),
    ];

    expect(latestPublishedVersions(documents).map((row) => row.id)).toEqual(['v3']);
  });

  it('ignores draft versions entirely', () => {
    const documents = [
      document({ id: 'published', version: 1 }),
      document({ id: 'draft', version: 2, publishedAt: null }),
    ];

    expect(latestPublishedVersions(documents).map((row) => row.id)).toEqual([
      'published',
    ]);
  });

  it('keeps keys independent and ordered', () => {
    const documents = [
      document({ id: 'photos', key: 'photos', version: 1 }),
      document({ id: 'privacy', key: 'privacy', version: 1 }),
    ];

    expect(latestPublishedVersions(documents).map((row) => row.key)).toEqual([
      'photos',
      'privacy',
    ]);
  });

  it('fails a requirement accepted at an older version', () => {
    const requirements = toRequirementRecords([document({ version: 2 })]);

    expect(missingRequiredConsents(requirements, [{ key: 'privacy', version: 1 }])).toHaveLength(1);
    expect(missingRequiredConsents(requirements, [{ key: 'privacy', version: 2 }])).toEqual([]);
  });

  it('does not require an optional document', () => {
    const requirements = toRequirementRecords([document({ required: false })]);

    expect(missingRequiredConsents(requirements, [])).toEqual([]);
  });

  it('matches only acceptances that name a published version', () => {
    const requirements = toRequirementRecords([document({ version: 2 })]);

    expect(matchedAcceptances(requirements, [{ key: 'privacy', version: 1 }])).toEqual([]);
    expect(matchedAcceptances(requirements, [{ key: 'unknown', version: 2 }])).toEqual([]);
    expect(matchedAcceptances(requirements, [{ key: 'privacy', version: 2 }])).toHaveLength(1);
  });
});
