import type { InvitationSummary, MemberSummary, RoleSummary } from '@event-platform/shared';

export interface RoleRow {
  id: string;
  key: string;
  name: string;
  isSystem: boolean;
  permissions: Array<{ permission: { key: string } }>;
}

export interface MemberRow {
  id: string;
  status: MemberSummary['status'];
  joinedAt: Date | null;
  user: { id: string; email: string; displayName: string | null };
  role: { id: string; key: string; name: string };
}

export interface MemberWithPermissions extends MemberRow {
  role: MemberRow['role'] & { permissions: Array<{ permission: { key: string } }> };
  capabilities: Array<{ capabilityKey: string }>;
}

export function toMemberSummary(row: MemberRow): MemberSummary {
  return {
    id: row.id,
    userId: row.user.id,
    email: row.user.email,
    displayName: row.user.displayName,
    roleId: row.role.id,
    roleKey: row.role.key,
    roleName: row.role.name,
    status: row.status,
    joinedAt: row.joinedAt ? row.joinedAt.toISOString() : null,
  };
}

export function toRoleSummary(row: RoleRow): RoleSummary {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    isSystem: row.isSystem,
    permissions: row.permissions.map((entry) => entry.permission.key),
  };
}

export function toInvitationSummary(row: {
  id: string;
  email: string;
  expiresAt: Date;
  role: { key: string };
}): InvitationSummary {
  return {
    id: row.id,
    email: row.email,
    roleKey: row.role.key,
    expiresAt: row.expiresAt.toISOString(),
  };
}

export function permissionKeys(member: MemberWithPermissions): string[] {
  return member.role.permissions.map((entry) => entry.permission.key);
}

export function directCapabilityKeys(member: MemberWithPermissions): string[] {
  return member.capabilities.map((entry) => entry.capabilityKey);
}
