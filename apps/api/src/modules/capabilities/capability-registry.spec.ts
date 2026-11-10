import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  ALL_CAPABILITY_KEYS,
  CAPABILITY_KEYS,
  CAPABILITY_MODULES,
  CAPABILITY_REGISTRY,
  MEMBERSHIP_CAPABILITY_KEYS,
  ORGANISATION_PERMISSIONS,
  ORGANIZATION_CAPABILITY_KEYS,
  SYSTEM_ROLE_TEMPLATES,
  capabilitiesForPermissions,
  capabilitiesByModule,
  getCapabilityDefinition,
  isAssignableToMembership,
  isAssignableToOrganization,
  isCapabilityKey,
  permissionsForCapabilities,
  resolveEffectiveCapabilities,
  withCapabilityDependencies,
} from '@event-platform/shared';

/**
 * The registry is the single source of truth. These tests fail when a new capability
 * is malformed, when a dependency points nowhere, when a legacy permission stops
 * mapping, or when the constant map and the definitions drift apart.
 */
describe('capability registry', () => {
  it('has unique keys', () => {
    const keys = CAPABILITY_REGISTRY.map((entry) => entry.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('keeps the typed constants in step with the definitions', () => {
    const constants = Object.values(CAPABILITY_KEYS).sort();
    expect(constants).toEqual([...ALL_CAPABILITY_KEYS].sort());
  });

  it('belongs to a declared module and has stable metadata', () => {
    const moduleKeys = new Set(CAPABILITY_MODULES.map((module) => module.key));

    for (const definition of CAPABILITY_REGISTRY) {
      expect(moduleKeys.has(definition.module)).toBe(true);
      expect(definition.name.length).toBeGreaterThan(2);
      expect(definition.description.length).toBeGreaterThan(10);
      expect(definition.status).toBe('active');
    }
  });

  it('points every dependency at a real, different capability', () => {
    for (const definition of CAPABILITY_REGISTRY) {
      for (const dependency of definition.dependsOn) {
        expect(dependency).not.toBe(definition.key);
        expect(getCapabilityDefinition(dependency)).toBeDefined();
      }
    }
  });

  it('never requires an entitlement from a platform-scoped capability', () => {
    for (const definition of CAPABILITY_REGISTRY) {
      if (definition.scope === 'platform') {
        expect(definition.requiresOrganizationEntitlement).toBe(false);
        expect(isAssignableToOrganization(definition.key)).toBe(false);
        expect(isAssignableToMembership(definition.key)).toBe(false);
      } else {
        expect(definition.requiresOrganizationEntitlement).toBe(true);
      }
    }
  });

  it('maps every organisation permission to at least one capability', () => {
    const unmapped = ORGANISATION_PERMISSIONS.filter(
      (permission) => capabilitiesForPermissions([permission]).length === 0,
    );

    expect(unmapped).toEqual([]);
  });

  it('derives legacy permissions back from capabilities', () => {
    const permissions = permissionsForCapabilities([
      CAPABILITY_KEYS.eventsView,
      CAPABILITY_KEYS.eventsPublish,
    ]);

    expect(permissions).toEqual(expect.arrayContaining(['event:read', 'event:publish']));
  });

  it('exposes organisation and membership assignment sets', () => {
    expect(ORGANIZATION_CAPABILITY_KEYS).not.toContain(
      CAPABILITY_KEYS.platformOrganizationsManage,
    );
    expect(MEMBERSHIP_CAPABILITY_KEYS).toContain(CAPABILITY_KEYS.eventsCreate);
    expect(isCapabilityKey(CAPABILITY_KEYS.eventsCreate)).toBe(true);
    expect(isCapabilityKey('events.make_up')).toBe(false);
  });

  it('groups every capability under its module exactly once', () => {
    const grouped = capabilitiesByModule().flatMap((module) =>
      module.capabilities.map((entry) => entry.key),
    );

    expect(grouped.sort()).toEqual([...ALL_CAPABILITY_KEYS].sort());
  });

  it('keeps every seeded role effective without adding module management', () => {
    for (const template of SYSTEM_ROLE_TEMPLATES) {
      const effective = resolveEffectiveCapabilities({
        organization: ORGANIZATION_CAPABILITY_KEYS,
        role: template.capabilities,
        direct: [],
      });

      expect(effective).toEqual([...template.capabilities].sort());
    }

    const checkInStaff = SYSTEM_ROLE_TEMPLATES.find((template) => template.key === 'checkin_staff');
    const programmeManager = SYSTEM_ROLE_TEMPLATES.find(
      (template) => template.key === 'programme_manager',
    );

    expect(checkInStaff?.capabilities).toEqual(
      expect.arrayContaining([CAPABILITY_KEYS.checkInView, CAPABILITY_KEYS.checkInOperate]),
    );
    expect(programmeManager?.capabilities).not.toContain(
      CAPABILITY_KEYS.eventsManageModules,
    );
  });

  it('backfills exactly the organisation capabilities in the migration', () => {
    const migration = readFileSync(
      resolve(process.cwd(), 'prisma/migrations/20261111090000_capabilities/migration.sql'),
      'utf8',
    );
    const backfilled = [...migration.matchAll(/\('([a-z_]+(?:\.[a-z_]+)+)'\)/g)].map(
      ([, key]) => key,
    );

    expect(backfilled.sort()).toEqual([...ORGANIZATION_CAPABILITY_KEYS].sort());
  });
});

describe('effective capability evaluation', () => {
  it('requires both the organisation entitlement and the member grant', () => {
    const effective = resolveEffectiveCapabilities({
      organization: [CAPABILITY_KEYS.eventsView, CAPABILITY_KEYS.eventsCreate],
      role: [CAPABILITY_KEYS.eventsView],
      direct: [],
    });

    expect(effective).toEqual([CAPABILITY_KEYS.eventsView]);
  });

  it('adds a direct grant to the role set', () => {
    const effective = resolveEffectiveCapabilities({
      organization: [CAPABILITY_KEYS.eventsView, CAPABILITY_KEYS.eventsPublish],
      role: [CAPABILITY_KEYS.eventsView],
      direct: [CAPABILITY_KEYS.eventsPublish],
    });

    expect(effective).toEqual(
      expect.arrayContaining([CAPABILITY_KEYS.eventsView, CAPABILITY_KEYS.eventsPublish]),
    );
  });

  it('drops a capability whose prerequisite is missing', () => {
    const effective = resolveEffectiveCapabilities({
      organization: [CAPABILITY_KEYS.eventsPublish],
      role: [],
      direct: [CAPABILITY_KEYS.eventsPublish],
    });

    expect(effective).toEqual([]);
  });

  it('keeps an organisation entitlement inactive when the member lacks it', () => {
    const effective = resolveEffectiveCapabilities({
      organization: [CAPABILITY_KEYS.organizationView],
      role: [CAPABILITY_KEYS.eventsView, CAPABILITY_KEYS.eventsCreate],
      direct: [],
    });

    expect(effective).toEqual([]);
  });

  it('expands an assignment to include prerequisites', () => {
    expect(withCapabilityDependencies([CAPABILITY_KEYS.eventsPublish])).toEqual(
      expect.arrayContaining([CAPABILITY_KEYS.eventsPublish, CAPABILITY_KEYS.eventsView]),
    );
  });
});
