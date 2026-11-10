import { describe, expect, it } from 'vitest';
import { CAPABILITY_KEYS } from '@event-platform/shared';
import {
  toCapabilityCatalogue,
  toMemberCapabilitiesView,
  toOrganizationCapabilitiesView,
} from './capabilities.mapper';

function member(overrides: Partial<Parameters<typeof toMemberCapabilitiesView>[0]> = {}) {
  return {
    id: 'member-1',
    userId: 'user-1',
    status: 'ACTIVE' as const,
    user: { email: 'person@example.test', displayName: 'Person' },
    role: {
      id: 'role-1',
      key: 'event_manager',
      name: 'Event Manager',
      permissions: [{ permission: { key: 'event:read' } }],
    },
    capabilities: [{ capabilityKey: CAPABILITY_KEYS.eventsPublish }],
    ...overrides,
  };
}

describe('capability views', () => {
  it('publishes the catalogue grouped by module without legacy permission names', () => {
    const catalogue = toCapabilityCatalogue();
    const serialized = JSON.stringify(catalogue);

    expect(catalogue.modules.length).toBeGreaterThan(0);
    expect(serialized).not.toContain('event:read');
    expect(serialized).not.toContain('"permissions"');
  });

  it('marks an entitlement whose dependency is missing as ineffective', () => {
    const view = toOrganizationCapabilitiesView(
      { id: 'org-1', slug: 'org', name: 'Organisation' },
      [CAPABILITY_KEYS.eventsPublish],
    );
    const publish = view.capabilities.find((entry) => entry.key === CAPABILITY_KEYS.eventsPublish);

    expect(publish?.organizationEntitled).toBe(true);
    expect(publish?.effective).toBe(false);
    expect(publish?.missingDependencies).toEqual([CAPABILITY_KEYS.eventsView]);
  });

  it('distinguishes role inheritance from a direct grant', () => {
    const view = toMemberCapabilitiesView(member(), [
      CAPABILITY_KEYS.eventsView,
      CAPABILITY_KEYS.eventsPublish,
    ]);
    const read = view.capabilities.find((entry) => entry.key === CAPABILITY_KEYS.eventsView);
    const publish = view.capabilities.find(
      (entry) => entry.key === CAPABILITY_KEYS.eventsPublish,
    );

    expect(read?.roleGranted).toBe(true);
    expect(read?.directGranted).toBe(false);
    expect(publish?.roleGranted).toBe(false);
    expect(publish?.directGranted).toBe(true);
    expect(publish?.effective).toBe(true);
    expect(view.effectiveCapabilities).toEqual(
      expect.arrayContaining([CAPABILITY_KEYS.eventsView, CAPABILITY_KEYS.eventsPublish]),
    );
  });

  it('shows a member capability as unavailable when the organisation lacks it', () => {
    const view = toMemberCapabilitiesView(member(), [CAPABILITY_KEYS.eventsView]);
    const publish = view.capabilities.find(
      (entry) => entry.key === CAPABILITY_KEYS.eventsPublish,
    );

    expect(publish?.organizationEntitled).toBe(false);
    expect(publish?.effective).toBe(false);
    expect(view.effectiveCapabilities).not.toContain(CAPABILITY_KEYS.eventsPublish);
  });
});
