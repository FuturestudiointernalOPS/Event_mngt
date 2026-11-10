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

/**
 * One route changes either field, or both.
 *
 * Suspension is expressed here rather than as a delete because a suspended member keeps
 * their history; only an accepted membership can be suspended.
 */
export const updateMemberRequestSchema = z
  .object({
    roleId: uuidSchema.optional(),
    status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
  })
  .refine((value) => value.roleId !== undefined || value.status !== undefined, {
    message: 'Provide a role, a status, or both',
    path: ['roleId'],
  });

export type UpdateMemberRequest = z.infer<typeof updateMemberRequestSchema>;

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
