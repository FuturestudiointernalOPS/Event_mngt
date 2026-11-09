import type { AuthUser, MembershipSummary, SessionSummary } from '@event-platform/shared';
import type { UserStatus } from '../../database/prisma-client';

/** Fields every account read may expose. Never includes the password hash. */
export const USER_SELECT = {
  id: true,
  email: true,
  displayName: true,
  isPlatformAdmin: true,
  status: true,
} as const;

export type UserRecord = {
  id: string;
  email: string;
  displayName: string | null;
  isPlatformAdmin: boolean;
  status: UserStatus;
};

export interface MembershipRow {
  organization: { id: string; slug: string; name: string };
  role: {
    key: string;
    permissions: Array<{ permission: { key: string } }>;
  };
}

export function toAuthUser(user: UserRecord): AuthUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    isPlatformAdmin: user.isPlatformAdmin,
  };
}

export function toMembershipSummary(row: MembershipRow): MembershipSummary {
  return {
    organizationId: row.organization.id,
    organizationSlug: row.organization.slug,
    organizationName: row.organization.name,
    roleKey: row.role.key,
    permissions: row.role.permissions.map((entry) => entry.permission.key),
  };
}

export interface SessionRow {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: Date;
  expiresAt: Date;
}

export function toSessionSummary(row: SessionRow, currentSessionId: string): SessionSummary {
  return {
    id: row.id,
    userAgent: row.userAgent,
    ipAddress: row.ipAddress,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    current: row.id === currentSessionId,
  };
}
