import { describe, expect, it } from 'vitest';
import type { EventWithModules } from './events.mapper';
import { toBrandOverrides, toDetail } from './events.mapper';

function eventRow(overrides: Partial<EventWithModules> = {}): EventWithModules {
  return {
    id: 'e1',
    organizationId: 'o1',
    parentEventId: null,
    slug: 'village-2026',
    name: 'Innovation Village 2026',
    description: null,
    format: 'IN_PERSON',
    status: 'DRAFT',
    visibility: 'PRIVATE',
    timeZone: 'Africa/Porto-Novo',
    startsAt: new Date('2026-11-10T09:00:00.000Z'),
    endsAt: new Date('2026-11-12T18:00:00.000Z'),
    venueName: null,
    venueAddress: null,
    registrationOpensAt: null,
    registrationClosesAt: null,
    publishedAt: null,
    createdByUserId: 'u1',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    bannerUrl: null,
    brandPrimaryColor: null,
    brandSecondaryColor: null,
    brandAccentColor: null,
    modules: [],
    ...overrides,
  } as EventWithModules;
}

describe('toBrandOverrides', () => {
  it('reports nothing when no colour is set, so the event inherits the workspace', () => {
    expect(toBrandOverrides(eventRow())).toBeNull();
  });

  it('reports only the colours that are set', () => {
    expect(toBrandOverrides(eventRow({ brandAccentColor: '#123456' }))).toEqual({
      accentColor: '#123456',
    });
    expect(
      toBrandOverrides(
        eventRow({ brandPrimaryColor: '#111111', brandSecondaryColor: '#222222' }),
      ),
    ).toEqual({ primaryColor: '#111111', secondaryColor: '#222222' });
  });
});

describe('toDetail', () => {
  it('exposes the banner and the colour overrides', () => {
    const detail = toDetail(
      eventRow({ bannerUrl: 'https://cdn.example/banner.png', brandPrimaryColor: '#101010' }),
    );

    expect(detail.bannerUrl).toBe('https://cdn.example/banner.png');
    expect(detail.brandOverrides).toEqual({ primaryColor: '#101010' });
  });

  it('keeps the absent values absent rather than inventing defaults', () => {
    const detail = toDetail(eventRow());

    expect(detail.bannerUrl).toBeNull();
    expect(detail.brandOverrides).toBeNull();
  });
});
