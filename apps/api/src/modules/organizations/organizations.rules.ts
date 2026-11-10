import {
  ORGANIZATION_CAPABILITY_KEYS,
  SYSTEM_ROLES,
  SYSTEM_ROLE_TEMPLATES,
  type Locale,
} from '@event-platform/shared';

/**
 * Pure provisioning rules.
 *
 * A new organisation is not a blank row: it needs workspace defaults, the default
 * entitlement set and the six system roles before the first administrator can do
 * anything. This file names that set so the provisioning service, the tests and the
 * documentation cannot drift.
 */

export interface ProvisionRolePlan {
  key: string;
  name: string;
  description: string;
  permissions: string[];
}

/** The roles every new workspace starts with. */
export function roleProvisioningPlans(): ProvisionRolePlan[] {
  return SYSTEM_ROLE_TEMPLATES.map((template) => ({
    key: template.key,
    name: template.name,
    description: template.description,
    permissions: [...template.permissions],
  }));
}

/** Every permission row a new workspace's roles need to connect to. */
export function rolePermissionKeys(plans: ProvisionRolePlan[]): string[] {
  return [...new Set(plans.flatMap((plan) => plan.permissions))].sort();
}

/**
 * The default entitlement set. It is the same set the capability migration backfilled
 * for existing organisations, so a new workspace is not born less capable.
 */
export function defaultEntitlementKeys(): string[] {
  return [...ORGANIZATION_CAPABILITY_KEYS];
}

export const ADMIN_ROLE_KEY = SYSTEM_ROLES.organisationAdmin;

export interface ProvisionOrganizationInput {
  name: string;
  /** Optional caller-chosen slug; otherwise derived from the name. */
  slug?: string;
  timeZone: string;
  defaultLocale: Locale;
  /** The account that becomes the first organisation administrator. */
  ownerUserId: string;
  /** The account that performed the provisioning (the caller or a platform admin). */
  actorUserId: string;
}
