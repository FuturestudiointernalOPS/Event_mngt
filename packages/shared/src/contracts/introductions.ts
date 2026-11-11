import { z } from 'zod';
import { paginationQuerySchema, uuidSchema } from './common';

/**
 * The introduction request queue (WP-17).
 *
 * Every transition appends one status-history row. History is append-only: there is no
 * update or delete route. Staff assignment is validated against the organisation.
 */

export const introductionStatusSchema = z.enum([
  'REQUESTED',
  'ASSIGNED',
  'INTRODUCED',
  'DECLINED',
]);

export type IntroductionStatus = z.infer<typeof introductionStatusSchema>;

export const introductionOutcomeSchema = z.enum([
  'CONNECTED',
  'FOLLOW_UP',
  'NO_MATCH',
  'DECLINED',
]);

export type IntroductionOutcome = z.infer<typeof introductionOutcomeSchema>;

export const introductionProfileSchema = z.object({
  id: uuidSchema,
  displayName: z.string(),
});

export type IntroductionProfile = z.infer<typeof introductionProfileSchema>;

export const introductionStatusHistorySchema = z.object({
  fromStatus: introductionStatusSchema.nullable(),
  toStatus: introductionStatusSchema,
  actorUserId: uuidSchema.nullable(),
  note: z.string().nullable(),
  createdAt: z.string(),
});

export type IntroductionStatusHistory = z.infer<
  typeof introductionStatusHistorySchema
>;

export const introductionRequestSchema = z.object({
  id: uuidSchema,
  requestingProfile: introductionProfileSchema,
  reason: z.string().nullable(),
  offeredHelp: z.string().nullable(),
  status: introductionStatusSchema,
  assignedToUserId: uuidSchema.nullable(),
  decidedAt: z.string().nullable(),
  outcome: introductionOutcomeSchema.nullable(),
  outcomeNotes: z.string().nullable(),
  createdAt: z.string(),
});

export type IntroductionRequest = z.infer<typeof introductionRequestSchema>;

export const introductionRequestDetailSchema = introductionRequestSchema.extend({
  history: z.array(introductionStatusHistorySchema),
});

export type IntroductionRequestDetail = z.infer<
  typeof introductionRequestDetailSchema
>;

export const createIntroductionRequestSchema = z.object({
  requestingProfileId: uuidSchema,
  reason: z.string().trim().max(1000).optional(),
  offeredHelp: z.string().trim().max(1000).optional(),
});

export type CreateIntroductionRequest = z.infer<
  typeof createIntroductionRequestSchema
>;

export const updateIntroductionRequestSchema = z.union([
  z.object({
    action: z.literal('assign'),
    assignedToUserId: uuidSchema,
  }),
  z.object({
    action: z.literal('decline'),
    outcome: z.enum(['NO_MATCH', 'DECLINED']),
    notes: z.string().trim().max(1000).optional(),
  }),
  z.object({
    action: z.literal('introduce'),
    outcome: z.enum(['CONNECTED', 'FOLLOW_UP']),
    notes: z.string().trim().max(1000).optional(),
  }),
]);

export type UpdateIntroductionRequest = z.infer<
  typeof updateIntroductionRequestSchema
>;

export const listIntroductionRequestsQuerySchema = paginationQuerySchema.extend({
  status: introductionStatusSchema.optional(),
});

export type ListIntroductionRequestsQuery = z.infer<
  typeof listIntroductionRequestsQuerySchema
>;
