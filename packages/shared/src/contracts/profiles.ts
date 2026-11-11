import { z } from 'zod';
import { paginationQuerySchema, uuidSchema } from './common';
import { registrationSummarySchema } from './registrations';

/**
 * Profiles, the organisation listing and the showcase.
 *
 * A public listing is one that is both approved and public; moderation alone never
 * exposes a row (WP-14).
 */

export const moderationStatusSchema = z.enum([
  'DRAFT',
  'PENDING',
  'APPROVED',
  'REJECTED',
]);

export type ModerationStatus = z.infer<typeof moderationStatusSchema>;

export const profileVisibilitySchema = z.enum(['PRIVATE', 'PUBLIC']);
export type ProfileVisibility = z.infer<typeof profileVisibilitySchema>;

export const participantProfileSchema = z.object({
  id: uuidSchema,
  registrationId: uuidSchema,
  reference: z.string(),
  headline: z.string().nullable(),
  bio: z.string().nullable(),
  company: z.string().nullable(),
  jobTitle: z.string().nullable(),
  websiteUrl: z.string().nullable(),
  photoUrl: z.string().nullable(),
  visibility: profileVisibilitySchema,
  moderationStatus: moderationStatusSchema,
  submittedAt: z.string().nullable(),
  moderatedAt: z.string().nullable(),
  moderationNote: z.string().nullable(),
});

export type ParticipantProfile = z.infer<typeof participantProfileSchema>;

/**
 * Staff edit on the participant's behalf. `submitForReview` moves DRAFT → PENDING;
 * it does not approve.
 */
export const updateParticipantProfileRequestSchema = z.object({
  headline: z.string().trim().max(160).nullable().optional(),
  bio: z.string().trim().max(4000).nullable().optional(),
  company: z.string().trim().max(180).nullable().optional(),
  jobTitle: z.string().trim().max(120).nullable().optional(),
  websiteUrl: z.url().max(2048).nullable().optional(),
  photoUrl: z.url().max(2048).nullable().optional(),
  visibility: profileVisibilitySchema.optional(),
  submitForReview: z.boolean().optional(),
});

export type UpdateParticipantProfileRequest = z.infer<
  typeof updateParticipantProfileRequestSchema
>;

export const moderateProfileRequestSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  note: z.string().trim().max(500).optional(),
});

export type ModerateProfileRequest = z.infer<typeof moderateProfileRequestSchema>;

export const organizationProfileSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  description: z.string().nullable(),
  websiteUrl: z.string().nullable(),
  logoUrl: z.string().nullable(),
  contactEmail: z.string().nullable(),
  country: z.string().nullable(),
  sector: z.string().nullable(),
  visibility: profileVisibilitySchema,
  moderationStatus: moderationStatusSchema,
  submittedAt: z.string().nullable(),
  moderatedAt: z.string().nullable(),
  moderationNote: z.string().nullable(),
});

export type OrganizationProfile = z.infer<typeof organizationProfileSchema>;

export const upsertOrganizationProfileRequestSchema = z.object({
  name: z.string().trim().min(1).max(180),
  description: z.string().trim().max(4000).nullable().optional(),
  websiteUrl: z.url().max(2048).nullable().optional(),
  logoUrl: z.url().max(2048).nullable().optional(),
  contactEmail: z.email().max(254).nullable().optional(),
  country: z.string().trim().max(80).nullable().optional(),
  sector: z.string().trim().max(120).nullable().optional(),
  visibility: profileVisibilitySchema.optional(),
});

export type UpsertOrganizationProfileRequest = z.infer<
  typeof upsertOrganizationProfileRequestSchema
>;

export const innovationSchema = z.object({
  id: uuidSchema,
  title: z.string(),
  summary: z.string().nullable(),
  category: z.string().nullable(),
  externalUrl: z.string().nullable(),
  imageUrl: z.string().nullable(),
  visibility: profileVisibilitySchema,
  moderationStatus: moderationStatusSchema,
  participantProfileId: uuidSchema.nullable(),
  organizationProfileId: uuidSchema.nullable(),
  submittedAt: z.string(),
  moderatedAt: z.string().nullable(),
  moderationNote: z.string().nullable(),
});

export type Innovation = z.infer<typeof innovationSchema>;

export const createInnovationRequestSchema = z
  .object({
    title: z.string().trim().min(1).max(180),
    summary: z.string().trim().max(2000).nullable().optional(),
    category: z.string().trim().max(120).nullable().optional(),
    externalUrl: z.url().max(2048).nullable().optional(),
    imageUrl: z.url().max(2048).nullable().optional(),
    participantProfileId: uuidSchema.optional(),
    organizationProfileId: uuidSchema.optional(),
  })
  .superRefine((value, ctx) => {
    const owners = [value.participantProfileId, value.organizationProfileId].filter(
      (owner) => owner !== undefined,
    );

    if (owners.length !== 1) {
      ctx.addIssue({
        code: 'custom',
        path: [
          value.organizationProfileId ? 'organizationProfileId' : 'participantProfileId',
        ],
        message: 'Attach a listing to exactly one profile',
      });
    }
  });

export type CreateInnovationRequest = z.infer<typeof createInnovationRequestSchema>;

export const listInnovationsQuerySchema = paginationQuerySchema.extend({
  moderationStatus: moderationStatusSchema.optional(),
});

export type ListInnovationsQuery = z.infer<typeof listInnovationsQuerySchema>;

export const listParticipantProfilesQuerySchema = paginationQuerySchema.extend({
  moderationStatus: moderationStatusSchema.optional(),
});

export type ListParticipantProfilesQuery = z.infer<
  typeof listParticipantProfilesQuerySchema
>;

export const listParticipantsQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().min(1).max(120).optional(),
});

export type ListParticipantsQuery = z.infer<typeof listParticipantsQuerySchema>;

export const participantSummarySchema = z.object({
  id: uuidSchema,
  email: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  phone: z.string().nullable(),
  organizationName: z.string().nullable(),
  jobTitle: z.string().nullable(),
  country: z.string().nullable(),
  registrationCount: z.number().int(),
});

export type ParticipantSummary = z.infer<typeof participantSummarySchema>;

export const participantDetailSchema = participantSummarySchema.extend({
  registrations: z.array(registrationSummarySchema),
});

export type ParticipantDetail = z.infer<typeof participantDetailSchema>;

// ---------------------------------------------------------------------------
// Public projections — approved and public only, no contact details
// ---------------------------------------------------------------------------

export const publicParticipantProfileSchema = z.object({
  displayName: z.string(),
  headline: z.string().nullable(),
  bio: z.string().nullable(),
  company: z.string().nullable(),
  jobTitle: z.string().nullable(),
  websiteUrl: z.string().nullable(),
  photoUrl: z.string().nullable(),
});

export type PublicParticipantProfile = z.infer<typeof publicParticipantProfileSchema>;

export const publicInnovationSchema = z.object({
  title: z.string(),
  summary: z.string().nullable(),
  category: z.string().nullable(),
  externalUrl: z.string().nullable(),
  imageUrl: z.string().nullable(),
});

export type PublicInnovation = z.infer<typeof publicInnovationSchema>;

export const publicShowcaseSchema = z.object({
  profiles: z.array(publicParticipantProfileSchema),
  innovations: z.array(publicInnovationSchema),
});

export type PublicShowcase = z.infer<typeof publicShowcaseSchema>;
