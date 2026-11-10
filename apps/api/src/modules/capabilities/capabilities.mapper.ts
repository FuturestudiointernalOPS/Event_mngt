import {
  capabilitiesByModule,
  capabilitiesForPermissions,
  resolveEffectiveCapabilities,
  type CapabilityDefinition,
} from '@event-platform/shared';
import type {
  CapabilityAssignmentView,
  CapabilityCatalogueResponse,
  CapabilityDefinitionView,
  MemberCapabilitiesView,
  OrganizationCapabilitiesView,
  PlatformOrganizationSummary,
} from '@event-platform/shared';

/** Public metadata for one capability. Legacy permission names are not exposed. */
export function toCapabilityDefinitionView(
  definition: CapabilityDefinition,
): CapabilityDefinitionView {
  return {
    key: definition.key,
    module: definition.module,
    name: definition.name,
    description: definition.description,
    scope: definition.scope,
    requiresOrganizationEntitlement: definition.requiresOrganizationEntitlement,
    sensitive: definition.sensitive,
    destructive: definition.destructive,
    dependsOn: [...definition.dependsOn],
    status: definition.status,
  };
}

export function toCapabilityCatalogue(): CapabilityCatalogueResponse {
  return {
    modules: capabilitiesByModule().map((module) => ({
      key: module.key,
      name: module.name,
      description: module.description,
      capabilities: module.capabilities.map(toCapabilityDefinitionView),
    })),
  };
}

interface AssignmentSources {
  organization: readonly string[];
  role: readonly string[];
  direct: readonly string[];
}

/**
 * One capability annotated with every source that grants it. `available` is the set
 * dependencies are checked against: organisation entitlements for the platform view,
 * effective capabilities for the member view.
 */
export function toAssignmentViews(
  sources: AssignmentSources,
  available: readonly string[],
): CapabilityAssignmentView[] {
  const organization = new Set(sources.organization);
  const role = new Set(sources.role);
  const direct = new Set(sources.direct);
  const effective = new Set(
    resolveEffectiveCapabilities({
      organization: sources.organization,
      role: sources.role,
      direct: sources.direct,
    }),
  );
  const availableSet = new Set(available);

  return capabilitiesByModule().flatMap((module) =>
    module.capabilities
      .filter((definition) => definition.scope !== 'platform')
      .map((definition) => ({
        ...toCapabilityDefinitionView(definition),
        organizationEntitled: organization.has(definition.key),
        roleGranted: role.has(definition.key),
        directGranted: direct.has(definition.key),
        effective: effective.has(definition.key),
        missingDependencies: definition.dependsOn.filter(
          (dependency) => !availableSet.has(dependency),
        ),
      })),
  );
}

export function toOrganizationCapabilitiesView(
  organization: { id: string; slug: string; name: string },
  organizationCapabilities: readonly string[],
): OrganizationCapabilitiesView {
  return {
    organization,
    capabilities: toAssignmentViews(
      { organization: organizationCapabilities, role: [], direct: [] },
      organizationCapabilities,
    ),
  };
}

export interface MemberCapabilityRow {
  id: string;
  userId: string;
  status: 'INVITED' | 'ACTIVE' | 'SUSPENDED';
  user: { email: string; displayName: string | null };
  role: {
    id: string;
    key: string;
    name: string;
    permissions: Array<{ permission: { key: string } }>;
  };
  capabilities: Array<{ capabilityKey: string }>;
}

export function toMemberCapabilitiesView(
  member: MemberCapabilityRow,
  organizationCapabilities: readonly string[],
): MemberCapabilitiesView {
  const roleCapabilities = capabilitiesForPermissions(
    member.role.permissions.map((entry) => entry.permission.key),
  );
  const directCapabilities = member.capabilities.map((entry) => entry.capabilityKey);
  const effectiveCapabilities = resolveEffectiveCapabilities({
    organization: organizationCapabilities,
    role: roleCapabilities,
    direct: directCapabilities,
  });

  return {
    member: {
      id: member.id,
      userId: member.userId,
      email: member.user.email,
      displayName: member.user.displayName,
      roleId: member.role.id,
      roleKey: member.role.key,
      roleName: member.role.name,
      status: member.status,
    },
    organizationCapabilities: [...organizationCapabilities].sort(),
    roleCapabilities: [...roleCapabilities].sort(),
    directCapabilities: [...directCapabilities].sort(),
    effectiveCapabilities,
    capabilities: toAssignmentViews(
      {
        organization: organizationCapabilities,
        role: roleCapabilities,
        direct: directCapabilities,
      },
      effectiveCapabilities,
    ),
  };
}

export function toPlatformOrganizationSummary(row: {
  id: string;
  slug: string;
  name: string;
  status: 'ACTIVE' | 'SUSPENDED';
  _count: { capabilities: number };
}): PlatformOrganizationSummary {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    status: row.status,
    capabilityCount: row._count.capabilities,
  };
}
