import { describe, expect, it } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { CAPABILITY_KEYS } from '@event-platform/shared';
import { CapabilityGuard } from './capability.guard';
import type { AuthenticatedRequest } from '../types/authenticated-request';

function contextFor(request: Partial<AuthenticatedRequest>): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function guardFor(capabilities: string[]): CapabilityGuard {
  const reflector = {
    getAllAndOverride: () => capabilities,
  } as unknown as Reflector;
  return new CapabilityGuard(reflector);
}

describe('CapabilityGuard', () => {
  it('allows a member whose effective set contains the capability', () => {
    const guard = guardFor([CAPABILITY_KEYS.eventsView]);
    const allow = guard.canActivate(
      contextFor({
        tenant: {
          organizationId: 'org-1',
          membershipId: 'member-1',
          roleKey: 'event_manager',
          capabilities: [CAPABILITY_KEYS.eventsView],
          organizationCapabilities: [],
          roleCapabilities: [],
          directCapabilities: [],
          permissions: [],
        },
      }),
    );

    expect(allow).toBe(true);
  });

  it('denies by default when the capability is absent', () => {
    const guard = guardFor([CAPABILITY_KEYS.eventsPublish]);

    expect(() =>
      guard.canActivate(
        contextFor({
          tenant: {
            organizationId: 'org-1',
            membershipId: 'member-1',
            roleKey: 'event_manager',
            capabilities: [CAPABILITY_KEYS.eventsView],
            organizationCapabilities: [],
            roleCapabilities: [],
            directCapabilities: [],
            permissions: [],
          },
        }),
      ),
    ).toThrowError();
  });

  it('denies a tenant capability when no membership was resolved', () => {
    const guard = guardFor([CAPABILITY_KEYS.eventsView]);

    expect(() => guard.canActivate(contextFor({}))).toThrowError();
  });

  it('requires the platform administrator claim for a platform capability', () => {
    const guard = guardFor([CAPABILITY_KEYS.platformOrganizationsManage]);
    const request = { user: { isPlatformAdmin: false } } as unknown as AuthenticatedRequest;

    expect(() => guard.canActivate(contextFor(request))).toThrowError();
  });

  it('allows a platform administrator through a platform capability', () => {
    const guard = guardFor([CAPABILITY_KEYS.platformOrganizationsManage]);
    const request = { user: { isPlatformAdmin: true } } as unknown as AuthenticatedRequest;

    expect(guard.canActivate(contextFor(request))).toBe(true);
  });

  it('allows an authenticated account through an account capability without a tenant', () => {
    const guard = guardFor([CAPABILITY_KEYS.organizationCreate]);
    const request = { user: { id: 'user-1' } } as unknown as AuthenticatedRequest;

    expect(guard.canActivate(contextFor(request))).toBe(true);
  });

  it('refuses an account capability without a signed-in account', () => {
    const guard = guardFor([CAPABILITY_KEYS.organizationCreate]);

    expect(() => guard.canActivate(contextFor({}))).toThrowError();
  });

  it('fails closed on an unknown capability key', () => {
    const guard = guardFor(['events.not_real']);

    expect(() => guard.canActivate(contextFor({}))).toThrowError();
  });
});
