import { z } from 'zod';
import { emailSchema } from './auth';
import { localeSchema, uuidSchema } from './common';
import { slugSchema } from './workspace';

export const createOrganizationRequestSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: slugSchema.optional(),
  timeZone: z.string().trim().min(1).max(64).default('Africa/Porto-Novo'),
  defaultLocale: localeSchema.default('fr'),
});
export type CreateOrganizationRequest = z.infer<typeof createOrganizationRequestSchema>;

export const memberStatusSchema = z.enum(['INVITED', 'ACTIVE', 'SUSPENDED']);

export const teamMemberSchema = z.object({
  id: uuidSchema,
  userId: uuidSchema,
  email: z.string(),
  displayName: z.string().nullable(),
  roleKey: z.string(),
  roleName: z.string(),
  status: memberStatusSchema,
  joinedAt: z.string().nullable(),
});
export type TeamMember = z.infer<typeof teamMemberSchema>;

export const roleSummarySchema = z.object({
  key: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  permissions: z.array(z.string()),
});
export type RoleSummary = z.infer<typeof roleSummarySchema>;

export const updateMemberRequestSchema = z
  .object({
    roleKey: z.string().min(1).max(60).optional(),
    status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
  })
  .refine((v) => v.roleKey !== undefined || v.status !== undefined, {
    message: 'Provide a role or a status',
  });
export type UpdateMemberRequest = z.infer<typeof updateMemberRequestSchema>;

export const inviteMemberRequestSchema = z.object({
  email: emailSchema,
  roleKey: z.string().min(1).max(60),
});
export type InviteMemberRequest = z.infer<typeof inviteMemberRequestSchema>;

export const invitationSchema = z.object({
  id: uuidSchema,
  email: z.string(),
  roleKey: z.string(),
  expiresAt: z.string(),
  acceptedAt: z.string().nullable(),
  revokedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type Invitation = z.infer<typeof invitationSchema>;

export const acceptInvitationRequestSchema = z.object({
  workspaceSlug: slugSchema,
  token: z.string().min(16).max(512),
});
export type AcceptInvitationRequest = z.infer<typeof acceptInvitationRequestSchema>;
