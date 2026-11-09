import { z } from 'zod';
import { paginationQuerySchema, uuidSchema } from './common';

const isoDateTime = z.iso.datetime({ offset: true });

/* --------------------------------------------------------------- showcase */

export const profileStatusSchema = z.enum(['PENDING', 'APPROVED', 'REJECTED']);
export type ProfileStatus = z.infer<typeof profileStatusSchema>;

const tagsSchema = z.array(z.string().trim().min(1).max(30)).max(10).default([]);

export const upsertProfileSchema = z.object({
  headline: z.string().trim().min(3).max(140),
  bio: z.string().trim().max(2000).optional(),
  tags: tagsSchema,
  isVisible: z.boolean().default(false),
});
export type UpsertProfileRequest = z.infer<typeof upsertProfileSchema>;

export const innovationInputSchema = z.object({
  title: z.string().trim().min(3).max(140),
  summary: z.string().trim().min(10).max(2000),
  sector: z.string().trim().max(60).optional(),
  tags: tagsSchema,
  isVisible: z.boolean().default(false),
});
export type InnovationInput = z.infer<typeof innovationInputSchema>;

export const moderationDecisionSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
});
export type ModerationDecision = z.infer<typeof moderationDecisionSchema>;

export interface ProfileView {
  id: string;
  registrationId: string;
  name: string;
  headline: string;
  bio: string | null;
  tags: string[];
  isVisible: boolean;
  status: ProfileStatus;
}

export interface InnovationView {
  id: string;
  ownerRegistrationId: string;
  ownerName: string;
  title: string;
  summary: string;
  sector: string | null;
  tags: string[];
  isVisible: boolean;
  status: ProfileStatus;
}

export interface PublicShowcase {
  profiles: Pick<ProfileView, 'name' | 'headline' | 'bio' | 'tags'>[];
  innovations: Pick<InnovationView, 'id' | 'title' | 'summary' | 'sector' | 'tags' | 'ownerName'>[];
}

/* --------------------------------------------------------------- meetings */

export const meetingStatusSchema = z.enum(['PROPOSED', 'ACCEPTED', 'CONFIRMED', 'DECLINED', 'CANCELLED', 'COMPLETED']);
export type MeetingStatus = z.infer<typeof meetingStatusSchema>;

export const proposeMeetingSchema = z
  .object({
    inviteeRegistrationId: uuidSchema,
    message: z.string().trim().max(1000).optional(),
    proposedStart: isoDateTime.optional(),
    proposedEnd: isoDateTime.optional(),
    location: z.string().trim().max(120).optional(),
  })
  .refine((v) => !v.proposedStart || !v.proposedEnd || new Date(v.proposedEnd) > new Date(v.proposedStart), {
    message: 'The end must be after the start',
    path: ['proposedEnd'],
  });
export type ProposeMeetingRequest = z.infer<typeof proposeMeetingSchema>;

export const respondMeetingSchema = z.object({ response: z.enum(['ACCEPT', 'DECLINE', 'CANCEL']) });
export type RespondMeetingRequest = z.infer<typeof respondMeetingSchema>;

export const meetingOutcomeSchema = z.object({
  status: z.enum(['COMPLETED', 'CANCELLED']),
  outcome: z.string().trim().max(1000).optional(),
});
export type MeetingOutcomeRequest = z.infer<typeof meetingOutcomeSchema>;

export interface MeetingView {
  id: string;
  proposerRegistrationId: string;
  proposerName: string;
  inviteeRegistrationId: string;
  inviteeName: string;
  message: string | null;
  proposedStart: string | null;
  proposedEnd: string | null;
  location: string | null;
  status: MeetingStatus;
  outcome: string | null;
  createdAt: string;
}

export interface DirectoryEntry {
  registrationId: string;
  name: string;
  headline: string;
  tags: string[];
}

/* ---------------------------------------------------------- introductions */

export const introductionStatusSchema = z.enum([
  'SUBMITTED',
  'IN_REVIEW',
  'APPROVED',
  'DECLINED',
  'INTRODUCED',
  'CLOSED',
]);
export type IntroductionStatus = z.infer<typeof introductionStatusSchema>;

export const requestIntroductionSchema = z.object({
  innovationId: uuidSchema,
  reason: z.string().trim().min(10).max(1000),
  helpOffered: z.string().trim().min(3).max(500),
});
export type RequestIntroductionRequest = z.infer<typeof requestIntroductionSchema>;

export const decideIntroductionSchema = z.object({
  status: introductionStatusSchema.exclude(['SUBMITTED']),
  note: z.string().trim().max(500).optional(),
  outcome: z.string().trim().max(1000).optional(),
});
export type DecideIntroductionRequest = z.infer<typeof decideIntroductionSchema>;

export const assignIntroductionSchema = z.object({ userId: uuidSchema.nullable() });
export type AssignIntroductionRequest = z.infer<typeof assignIntroductionSchema>;

export const listIntroductionsQuerySchema = paginationQuerySchema.extend({
  status: introductionStatusSchema.optional(),
  assignedToMe: z.coerce.boolean().optional(),
});
export type ListIntroductionsQuery = z.infer<typeof listIntroductionsQuerySchema>;

export interface IntroductionView {
  id: string;
  innovationId: string;
  innovationTitle: string;
  requesterRegistrationId: string;
  requesterName: string;
  reason: string;
  helpOffered: string;
  status: IntroductionStatus;
  assignedToUserId: string | null;
  decisionNote: string | null;
  outcome: string | null;
  createdAt: string;
  history: { fromStatus: IntroductionStatus | null; toStatus: IntroductionStatus; note: string | null; createdAt: string }[];
}

/* ---------------------------------------------------------------- check-in */

export const checkInSourceSchema = z.enum(['ONLINE', 'OFFLINE', 'MANUAL']);
export type CheckInSource = z.infer<typeof checkInSourceSchema>;

export const scanSchema = z.object({
  /** The QR payload. Omit for a manual check-in by registration id. */
  code: z.string().trim().min(1).max(200).optional(),
  registrationId: uuidSchema.optional(),
  source: checkInSourceSchema.default('ONLINE'),
  scannedAt: isoDateTime.optional(),
  /** Device-generated id: makes a re-sent offline scan idempotent. */
  clientScanId: z.string().trim().min(8).max(80).optional(),
});
export type ScanRequest = z.infer<typeof scanSchema>;

export const syncScansSchema = z.object({ scans: z.array(scanSchema).min(1).max(500) });
export type SyncScansRequest = z.infer<typeof syncScansSchema>;

export type ScanResultKind = 'checked_in' | 'duplicate' | 'invalid' | 'not_confirmed';

export interface ScanResult {
  result: ScanResultKind;
  clientScanId: string | null;
  participant: { registrationId: string; name: string; categoryName: string } | null;
  checkedInAt: string | null;
}

export interface CheckInManifestEntry {
  registrationId: string;
  codeHash: string;
  name: string;
  categoryName: string;
  checkedIn: boolean;
}

export interface CheckInStats {
  confirmed: number;
  checkedIn: number;
  byCategory: { categoryName: string; confirmed: number; checkedIn: number }[];
}
