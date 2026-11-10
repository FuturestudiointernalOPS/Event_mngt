import { describe, expect, it } from 'vitest';
import { CAPABILITY_KEYS } from '@event-platform/shared';
import { MemberStatus } from '../../database/prisma-client';
import { toTenantAccess, type MembershipWithRole } from './permissions.mapper';

const ALL_ORGANIZATION_CAPABILITIES = [
  CAPABILITY_KEYS.organizationView,
  CAPABILITY_KEYS.organizationViewMembers,
  CAPABILITY_KEYS.organizationManagePermissions,
  CAPABILITY_KEYS.eventsView,
  CAPABILITY_KEYS.eventsCreate,
  CAPABILITY_KEYS.eventsPublish,
  CAPABILITY_KEYS.registrationsView,
  CAPABILITY_KEYS.registrationsViewForm,
  CAPABILITY_KEYS.registrationsManageForm,
  CAPABILITY_KEYS.reportsView,
  CAPABILITY_KEYS.reportsExport,
  CAPABILITY_KEYS.organizationViewAuditLog,
];

function membership(overrides: Partial<MembershipWithRole> = {}): MembershipWithRole {
  return {
    id: 'member-1',
    status: MemberStatus.ACTIVE,
    capabilities: [],
    role: {
      key: 'admin',
      permissions: [
        { permission: { key: 'workspace:read' } },
        { permission: { key: 'event:read' } },
        { permission: { key: 'event:publish' } },
      ],
    },
    organization: {
      capabilities: ALL_ORGANIZATION_CAPABILITIES.map((capabilityKey) => ({ capabilityKey })),
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

  it('derives capabilities from role permissions and keeps the entitlement intersection', () => {
    const access = toTenantAccess('org-1', membership());

    expect(access.roleCapabilities).toEqual(
      expect.arrayContaining([
        CAPABILITY_KEYS.organizationView,
        CAPABILITY_KEYS.eventsView,
        CAPABILITY_KEYS.eventsPublish,
      ]),
    );
    expect(access.capabilities).toEqual(
      expect.arrayContaining([
        CAPABILITY_KEYS.organizationView,
        CAPABILITY_KEYS.eventsView,
        CAPABILITY_KEYS.eventsPublish,
      ]),
    );
    expect(access.capabilities).not.toContain(CAPABILITY_KEYS.eventsCreate);
  });

  it('removes a capability the organisation is not entitled to', () => {
    const access = toTenantAccess(
      'org-1',
      membership({
        organization: {
          capabilities: [{ capabilityKey: CAPABILITY_KEYS.organizationView }],
        },
      }),
    );

    expect(access.capabilities).toEqual([CAPABILITY_KEYS.organizationView]);
  });

  it('honours a direct grant when the organisation is entitled', () => {
    const access = toTenantAccess(
      'org-1',
      membership({ capabilities: [{ capabilityKey: CAPABILITY_KEYS.organizationViewAuditLog }] }),
    );

    expect(access.directCapabilities).toEqual([
      CAPABILITY_KEYS.organizationViewAuditLog,
    ]);
    expect(access.capabilities).toContain(CAPABILITY_KEYS.organizationViewAuditLog);
  });

  it('keeps a direct grant inactive when its prerequisite is missing', () => {
    const access = toTenantAccess(
      'org-1',
      membership({
        role: { key: 'viewer', permissions: [{ permission: { key: 'workspace:read' } }] },
        capabilities: [{ capabilityKey: CAPABILITY_KEYS.registrationsApprove }],
      }),
    );

    // registrations.approve depends on registrations.view, which the member lacks.
    expect(access.directCapabilities).toEqual([CAPABILITY_KEYS.registrationsApprove]);
    expect(access.capabilities).not.toContain(CAPABILITY_KEYS.registrationsApprove);
  });

  it('returns an empty effective set for a role without grants', () => {
    const access = toTenantAccess(
      'org-1',
      membership({ role: { key: 'viewer', permissions: [] } }),
    );

    expect(access.capabilities).toEqual([]);
    expect(access.permissions).toEqual([]);
  });

  it('keeps the same account on two organisations independent', () => {
    const inA = toTenantAccess(
      'org-a',
      membership({
        organization: {
          capabilities: [
            { capabilityKey: CAPABILITY_KEYS.organizationView },
            { capabilityKey: CAPABILITY_KEYS.eventsView },
          ],
        },
      }),
    );
    const inB = toTenantAccess(
      'org-b',
      membership({
        organization: {
          capabilities: [{ capabilityKey: CAPABILITY_KEYS.organizationView }],
        },
      }),
    );

    expect(inA.capabilities).toContain(CAPABILITY_KEYS.eventsView);
    expect(inB.capabilities).not.toContain(CAPABILITY_KEYS.eventsView);
    expect(inB.capabilities).toContain(CAPABILITY_KEYS.organizationView);
  });
});
