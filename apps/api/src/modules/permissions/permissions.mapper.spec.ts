import { describe, expect, it } from 'vitest';
import { MemberStatus } from '../../database/prisma-client';
import { toTenantAccess, type MembershipWithRole } from './permissions.mapper';

function membership(overrides: Partial<MembershipWithRole> = {}): MembershipWithRole {
  return {
    id: 'member-1',
    status: MemberStatus.ACTIVE,
    role: {
      key: 'admin',
      permissions: [
        { permission: { key: 'workspace:read' } },
        { permission: { key: 'event:publish' } },
      ],
    },
    ...overrides,
  };
}

describe('toTenantAccess', () => {
  it('carries the organisation, membership and role through', () => {
    const access = toTenantAccess('org-1', membership());

    expect(access.organizationId).toBe('org-1');
    expect(access.membershipId).toBe('member-1');
    expect(access.roleKey).toBe('admin');
  });

  it('flattens role permissions into the permission set', () => {
    expect(toTenantAccess('org-1', membership()).permissions).toEqual([
      'workspace:read',
      'event:publish',
    ]);
  });

  it('returns an empty permission set for a role without grants', () => {
    const access = toTenantAccess(
      'org-1',
      membership({ role: { key: 'viewer', permissions: [] } }),
    );

    expect(access.permissions).toEqual([]);
  });
});
