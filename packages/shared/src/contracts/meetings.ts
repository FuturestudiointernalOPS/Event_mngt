import { z } from 'zod';
import { paginationQuerySchema, uuidSchema } from './common';

/**
 * Meetings between two participant profiles (WP-17).
 *
 * Participant self-service is a later slice; these routes are the staff surface and
 * apply the same state machine the participant routes will call.
 */

export const meetingStatusSchema = z.enum([
  'PROPOSED',
  'ACCEPTED',
  'DECLINED',
  'CANCELLED',
  'COMPLETED',
]);

export type MeetingStatus = z.infer<typeof meetingStatusSchema>;

export const meetingOutcomeSchema = z.enum(['MET', 'NO_SHOW', 'FOLLOW_UP']);
export type MeetingOutcome = z.infer<typeof meetingOutcomeSchema>;

export const meetingProfileSchema = z.object({
  id: uuidSchema,
  displayName: z.string(),
});

export type MeetingProfile = z.infer<typeof meetingProfileSchema>;

export const meetingSchema = z.object({
  id: uuidSchema,
  status: meetingStatusSchema,
  proposedAt: z.string(),
  durationMinutes: z.number().int(),
  note: z.string().nullable(),
  requiresStaffConfirmation: z.boolean(),
  decidedAt: z.string().nullable(),
  outcome: meetingOutcomeSchema.nullable(),
  outcomeNotes: z.string().nullable(),
  proposer: meetingProfileSchema,
  recipient: meetingProfileSchema,
});

export type Meeting = z.infer<typeof meetingSchema>;

export const createMeetingRequestSchema = z.object({
  proposerProfileId: uuidSchema,
  recipientProfileId: uuidSchema,
  durationMinutes: z.number().int().min(5).max(240).optional(),
  note: z.string().trim().max(1000).optional(),
});

export type CreateMeetingRequest = z.infer<typeof createMeetingRequestSchema>;

const completeMeetingSchema = z.object({
  action: z.literal('complete'),
  outcome: meetingOutcomeSchema,
  notes: z.string().trim().max(1000).optional(),
});

export const updateMeetingRequestSchema = z.union([
  z.object({ action: z.literal('accept') }),
  z.object({ action: z.literal('decline') }),
  z.object({ action: z.literal('cancel') }),
  completeMeetingSchema,
]);

export type UpdateMeetingRequest = z.infer<typeof updateMeetingRequestSchema>;

export const listMeetingsQuerySchema = paginationQuerySchema.extend({
  status: meetingStatusSchema.optional(),
});

export type ListMeetingsQuery = z.infer<typeof listMeetingsQuerySchema>;
