import {
  CAPABILITY_KEYS,
  capabilitiesBeyond,
  getCapabilityDefinition,
  isAssignableToMembership,
  isAssignableToOrganization,
  withCapabilityDependencies,
} from '@event-platform/shared';
import { AppException } from '../../common/app-exception';

/**
 * Capability management rules. Pure functions, so they are directly testable and the
 * service stays a transaction boundary rather than a pile of conditionals.
 */

export function assertKnownCapability(capabilityKey: string): void {
  if (!getCapabilityDefinition(capabilityKey)) {
    throw AppException.badRequest('unknown_capability', 'That capability does not exist.');
  }
}

export function assertOrganizationAssignable(capabilityKey: string): void {
  assertKnownCapability(capabilityKey);

  if (!isAssignableToOrganization(capabilityKey)) {
    throw AppException.badRequest(
      'capability_scope_invalid',
      'That capability cannot be assigned to an organisation.',
    );
  }
}

export function assertMembershipAssignable(capabilityKey: string): void {
  assertKnownCapability(capabilityKey);

  if (!isAssignableToMembership(capabilityKey)) {
    throw AppException.badRequest(
      'capability_scope_invalid',
      'That capability cannot be assigned to a member.',
    );
  }
}

/**
 * Returns the full set to store, including prerequisites. An organisation or member
 * administrator never has to know the dependency graph by heart.
 */
export function expandAssignment(capabilityKey: string): string[] {
  return withCapabilityDependencies([capabilityKey]);
}

/**
 * A member may only receive capabilities their organisation is entitled to. This is
 * checked after prerequisites are applied, so the answer is exact rather than a guess.
 */
export function assertEntitledByOrganization(
  capabilityKeys: readonly string[],
  organizationCapabilities: readonly string[],
): void {
  const entitled = new Set(organizationCapabilities);
  const outside = capabilityKeys.filter((key) => !entitled.has(key));

  if (outside.length > 0) {
    throw AppException.forbidden(
      'capability_not_entitled',
      'Your organisation is not entitled to that capability.',
      { capabilities: outside },
    );
  }
}

/**
 * A grantor cannot hand out a capability they do not hold themselves. This closes the
 * delegation escalation path: managing permissions does not imply owning every
 * capability the organisation is entitled to.
 */
export function assertCanGrantCapabilities(
  actorCapabilities: readonly string[],
  requested: readonly string[],
): void {
  const beyond = capabilitiesBeyond(actorCapabilities, requested);

  if (beyond.length > 0) {
    throw AppException.forbidden(
      'capability_escalation_denied',
      'You cannot grant a capability you do not hold yourself.',
      { capabilities: beyond },
    );
  }
}

/** The last remaining workspace administrator cannot be removed or demoted. */
export function assertAdministratorRemains(remainingAdministrators: number): void {
  if (remainingAdministrators < 1) {
    throw AppException.unprocessable(
      'last_administrator',
      'A workspace must keep at least one administrator.',
    );
  }
}

export function isAdministrativeCapabilities(capabilities: readonly string[]): boolean {
  return capabilities.includes(CAPABILITY_KEYS.organizationManagePermissions);
}
