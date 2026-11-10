import { z } from 'zod';
import { uuidSchema } from './common';

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Enter a valid email address'));

/**
 * Minimum lengths follow current guidance for account passwords. Argon2id hashing is
 * performed server-side; the hash never leaves the API.
 */
export const passwordSchema = z
  .string()
  .min(10, 'Use at least 10 characters')
  .max(128, 'Use at most 128 characters');

export const displayNameSchema = z.string().trim().min(1).max(120);

export const registerRequestSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: displayNameSchema.optional(),
});

export type RegisterRequest = z.infer<typeof registerRequestSchema>;

export const loginRequestSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required').max(128),
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const verifyEmailRequestSchema = z.object({
  token: z.string().min(16).max(512),
});

export type VerifyEmailRequest = z.infer<typeof verifyEmailRequestSchema>;

export const forgotPasswordRequestSchema = z.object({
  email: emailSchema,
});

export type ForgotPasswordRequest = z.infer<typeof forgotPasswordRequestSchema>;

export const resetPasswordRequestSchema = z.object({
  token: z.string().min(16).max(512),
  password: passwordSchema,
});

export type ResetPasswordRequest = z.infer<typeof resetPasswordRequestSchema>;

export const authUserSchema = z.object({
  id: uuidSchema,
  email: z.string(),
  displayName: z.string().nullable(),
  isPlatformAdmin: z.boolean(),
});

export type AuthUser = z.infer<typeof authUserSchema>;

export const membershipSummarySchema = z.object({
  organizationId: uuidSchema,
  organizationSlug: z.string(),
  organizationName: z.string(),
  roleKey: z.string(),
  /** Effective capabilities: organisation entitlement ∩ role ∪ direct grants. */
  capabilities: z.array(z.string()),
  permissions: z.array(z.string()),
});

export type MembershipSummary = z.infer<typeof membershipSummarySchema>;

/**
 * The access token is returned in the body and must be held in memory by the client.
 * The refresh token is delivered as an HttpOnly cookie and is never part of this payload.
 */
export const authenticatedSessionSchema = z.object({
  user: authUserSchema,
  memberships: z.array(membershipSummarySchema),
  accessToken: z.string(),
  expiresIn: z.number().int(),
});

export type AuthenticatedSession = z.infer<typeof authenticatedSessionSchema>;

export const currentUserResponseSchema = z.object({
  user: authUserSchema,
  memberships: z.array(membershipSummarySchema),
});

export type CurrentUserResponse = z.infer<typeof currentUserResponseSchema>;

export const refreshResponseSchema = z.object({
  accessToken: z.string(),
  expiresIn: z.number().int(),
});

export type RefreshResponse = z.infer<typeof refreshResponseSchema>;

export const sessionSummarySchema = z.object({
  id: uuidSchema,
  userAgent: z.string().nullable(),
  ipAddress: z.string().nullable(),
  createdAt: z.string(),
  expiresAt: z.string(),
  current: z.boolean(),
});

export type SessionSummary = z.infer<typeof sessionSummarySchema>;
