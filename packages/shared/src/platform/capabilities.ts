import type { PermissionKey } from './permissions';
import { CAPABILITY_DEFINITIONS } from './capability-definitions';

/**
 * Capability model and pure evaluation helpers.
 *
 * The authoritative list lives in `capability-definitions.ts`. Everything else —
 * guards, management screens, seeds and tests — derives from it, so frontend and
 * backend cannot disagree about what a capability means.
 *
 * Effective access is:
 *
 *   (role capabilities ∪ directly granted capabilities)
 *     ∩ organisation entitlements
 *     filtered by capability dependencies
 *
 * Dependencies are filtered last so revoking a prerequisite immediately disables the
 * capabilities that rely on it, without deleting historical assignments.
 */

export type CapabilityModuleKey =
  | 'organization'
  | 'events'
  | 'registrations'
  | 'participants'
  | 'profiles'
  | 'check_in'
  | 'meetings'
  | 'introductions'
  | 'reports'
  | 'platform';

export type CapabilityScope = 'organization' | 'membership' | 'both' | 'platform';

export type CapabilityStatus = 'active' | 'deprecated';

export interface CapabilityDefinition {
  key: string;
  module: CapabilityModuleKey;
  name: string;
  description: string;
  scope: CapabilityScope;
  requiresOrganizationEntitlement: boolean;
  sensitive: boolean;
  destructive: boolean;
  dependsOn: string[];
  /** Legacy `resource:action` permissions this capability replaces. */
  permissions: PermissionKey[];
  status: CapabilityStatus;
}

export interface CapabilityModuleDefinition {
  key: CapabilityModuleKey;
  name: string;
  description: string;
}

export const CAPABILITY_MODULES: CapabilityModuleDefinition[] = [
  { key: 'organization', name: 'Organisation', description: 'Workspace, team, branding and audit.' },
  { key: 'events', name: 'Events', description: 'Events, editions and event modules.' },
  { key: 'registrations', name: 'Registrations', description: 'Registrations, forms, categories, consent and badges.' },
  { key: 'participants', name: 'Participants', description: 'Participant records.' },
  { key: 'profiles', name: 'Profiles & showcase', description: 'Participant, organisation and innovation profiles.' },
  { key: 'check_in', name: 'Check-in', description: 'Attendance scanning and summaries.' },
  { key: 'meetings', name: 'Meetings', description: 'Meeting proposals and outcomes.' },
  { key: 'introductions', name: 'Introductions', description: 'Introduction queue and outcomes.' },
  { key: 'reports', name: 'Reports', description: 'Dashboards and exports.' },
  { key: 'platform', name: 'Platform', description: 'Cross-tenant platform administration.' },
];

/** Typed constants so a typo cannot silently invent a capability. */
export { CAPABILITY_KEYS } from './capability-keys';

export const CAPABILITY_REGISTRY: readonly CapabilityDefinition[] = CAPABILITY_DEFINITIONS;

const DEFINITION_BY_KEY = new Map(CAPABILITY_REGISTRY.map((entry) => [entry.key, entry]));

export const ALL_CAPABILITY_KEYS: string[] = CAPABILITY_REGISTRY.filter(
  (entry) => entry.status === 'active',
).map((entry) => entry.key);

/** Capabilities an organisation can be entitled to. */
export const ORGANIZATION_CAPABILITY_KEYS: string[] = CAPABILITY_REGISTRY.filter(
  (entry) => entry.status === 'active' && entry.scope !== 'platform',
).map((entry) => entry.key);

/** Capabilities an organisation administrator may grant directly to a member. */
export const MEMBERSHIP_CAPABILITY_KEYS: string[] = CAPABILITY_REGISTRY.filter(
  (entry) => entry.status === 'active' && (entry.scope === 'membership' || entry.scope === 'both'),
).map((entry) => entry.key);

const CAPABILITY_KEY_SET = new Set(ALL_CAPABILITY_KEYS);

export function getCapabilityDefinition(key: string): CapabilityDefinition | undefined {
  return DEFINITION_BY_KEY.get(key);
}

export function isCapabilityKey(key: string): boolean {
  return CAPABILITY_KEY_SET.has(key);
}

export function isAssignableToOrganization(key: string): boolean {
  const definition = getCapabilityDefinition(key);
  return definition !== undefined && definition.scope !== 'platform' && definition.status === 'active';
}

export function isAssignableToMembership(key: string): boolean {
  const definition = getCapabilityDefinition(key);
  return (
    definition !== undefined &&
    (definition.scope === 'membership' || definition.scope === 'both') &&
    definition.status === 'active'
  );
}

export function capabilitiesByModule(): Array<
  CapabilityModuleDefinition & { capabilities: CapabilityDefinition[] }
> {
  return CAPABILITY_MODULES.map((module) => ({
    ...module,
    capabilities: CAPABILITY_REGISTRY.filter((entry) => entry.module === module.key),
  }));
}

/**
 * Capabilities implied by legacy role permissions. A capability is included when any
 * of its legacy permissions is granted. Deprecated capabilities are ignored.
 */
export function capabilitiesForPermissions(permissions: readonly string[]): string[] {
  const granted = new Set(permissions);
  const result = new Set<string>();

  for (const definition of CAPABILITY_REGISTRY) {
    if (definition.status !== 'active' || definition.scope === 'platform') {
      continue;
    }
    if (definition.permissions.some((permission) => granted.has(permission))) {
      result.add(definition.key);
    }
  }

  return [...result].sort();
}

/**
 * Legacy permissions implied by a capability set. Used while the old route decorators
 * and business rules are still being retired; capability checks remain authoritative.
 */
export function permissionsForCapabilities(capabilities: readonly string[]): string[] {
  const granted = new Set(capabilities);
  const result = new Set<string>();

  for (const definition of CAPABILITY_REGISTRY) {
    if (granted.has(definition.key)) {
      for (const permission of definition.permissions) {
        result.add(permission);
      }
    }
  }

  return [...result].sort();
}

export function missingCapabilityDependencies(
  capabilityKey: string,
  granted: readonly string[],
): string[] {
  const definition = getCapabilityDefinition(capabilityKey);
  if (!definition) {
    return [];
  }
  const available = new Set(granted);
  return definition.dependsOn.filter((dependency) => !available.has(dependency));
}

/**
 * Adds every prerequisite of the given capabilities. Assignments are stored dependency
 * closed, so a manager cannot grant "publish" while leaving out "view".
 */
export function withCapabilityDependencies(keys: readonly string[]): string[] {
  const result = new Set(keys.filter((key) => isCapabilityKey(key)));
  let changed = true;

  while (changed) {
    changed = false;
    for (const key of [...result]) {
      const definition = getCapabilityDefinition(key);
      if (!definition) {
        continue;
      }
      for (const dependency of definition.dependsOn) {
        if (!result.has(dependency)) {
          result.add(dependency);
          changed = true;
        }
      }
    }
  }

  return [...result].sort();
}

export interface EffectiveCapabilityInput {
  /** Capabilities the organisation is entitled to. */
  organization: readonly string[];
  /** Capabilities implied by the member's role. */
  role: readonly string[];
  /** Capabilities granted directly to the membership. */
  direct: readonly string[];
}

/**
 * The single evaluation rule. A capability is effective only when the organisation is
 * entitled to it, the member has it (through a role or directly), and every
 * prerequisite is itself effective.
 */
export function resolveEffectiveCapabilities(input: EffectiveCapabilityInput): string[] {
  const entitled = new Set(input.organization.filter(isAssignableToOrganization));
  const grants = new Set(
    [...input.role, ...input.direct].filter((key) => isCapabilityKey(key)),
  );

  const effective = [...grants].filter((key) => entitled.has(key));

  // Fixed-point removal: a capability whose prerequisite is not effective is inactive.
  let changed = true;
  while (changed) {
    changed = false;
    const current = new Set(effective);

    for (const key of [...effective]) {
      const definition = getCapabilityDefinition(key);
      if (!definition || definition.dependsOn.some((dependency) => !current.has(dependency))) {
        effective.splice(effective.indexOf(key), 1);
        changed = true;
      }
    }
  }

  return effective.sort();
}
