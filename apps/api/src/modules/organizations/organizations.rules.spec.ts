import { describe, expect, it } from 'vitest';
import {
  ORGANIZATION_CAPABILITY_KEYS,
  SYSTEM_ROLES,
  SYSTEM_ROLE_TEMPLATES,
} from '@event-platform/shared';
import {
  ADMIN_ROLE_KEY,
  defaultEntitlementKeys,
  rolePermissionKeys,
  roleProvisioningPlans,
} from './organizations.rules';

describe('organisation provisioning rules', () => {
  it('provisions every system role, including the administrator', () => {
    const plans = roleProvisioningPlans();

    expect(plans.map((plan) => plan.key)).toEqual(
      SYSTEM_ROLE_TEMPLATES.map((template) => template.key),
    );
    expect(plans.some((plan) => plan.key === SYSTEM_ROLES.organisationAdmin)).toBe(
      true,
    );
    expect(ADMIN_ROLE_KEY).toBe(SYSTEM_ROLES.organisationAdmin);
  });

  it('collects each permission once, sorted', () => {
    const keys = rolePermissionKeys(roleProvisioningPlans());

    expect(keys).toEqual([...new Set(keys)].sort());
    expect(keys).toContain('workspace:read');
    expect(keys).toContain('report:export');
  });

  it('grants the same default entitlements as an existing organisation', () => {
    const keys = defaultEntitlementKeys();

    expect(keys.sort()).toEqual([...ORGANIZATION_CAPABILITY_KEYS].sort());
    expect(keys).toContain('organization.view');
    expect(keys).not.toContain('platform.organizations.manage');
    expect(keys).not.toContain('organization.create');
  });
});
