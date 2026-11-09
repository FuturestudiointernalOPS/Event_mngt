import { z } from 'zod';
import { uuidSchema } from './common';

export const memberStatusSchema = z.enum(['INVITED', 'ACTIVE', 'SUSPENDED']);
export type MemberStatus = z.infer<typeof memberStatusSchema>;

export const memberSummarySchema = z.object({
  id: uuidSchema,
  userId: uuidSchema,
  email: z.email(),
  displayName: z.string().nullable(),
  roleId: uuidSchema,
  roleKey: z.string(),
  roleName: z.string(),
  status: memberStatusSchema,
  joinedAt: z.string().nullable(),
});

export type MemberSummary = z.infer<typeof memberSummarySchema>;

/** A role as the team screen needs it: enough to pick one, nothing more. */
export const roleSummarySchema = z.object({
  id: uuidSchema,
  key: z.string(),
  name: z.string(),
  isSystem: z.boolean(),
  permissions: z.array(z.string()),
});

export type RoleSummary = z.infer<typeof roleSummarySchema>;

export const inviteMemberRequestSchema = z.object({
  email: z.email(),
  roleId: uuidSchema,
});

export type InviteMemberRequest = z.infer<typeof inviteMemberRequestSchema>;

export const updateMemberRoleRequestSchema = z.object({
  roleId: uuidSchema,
});

export type UpdateMemberRoleRequest = z.infer<typeof updateMemberRoleRequestSchema>;

/** Returned when an invitation is created; the raw token is only sent by email. */
export const invitationSummarySchema = z.object({
  id: uuidSchema,
  email: z.email(),
  roleKey: z.string(),
  expiresAt: z.string(),
});

export type InvitationSummary = z.infer<typeof invitationSummarySchema>;

export const acceptInvitationResponseSchema = z.object({
  organizationId: uuidSchema,
  organizationSlug: z.string(),
  organizationName: z.string(),
});

export type AcceptInvitationResponse = z.infer<typeof acceptInvitationResponseSchema>;
