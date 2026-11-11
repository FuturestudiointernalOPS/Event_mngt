import { z } from 'zod';
import { emailSchema } from './auth';
import { localeSchema, paginationQuerySchema, uuidSchema } from './common';
import { slugSchema } from './workspace';

/**
 * Organisation onboarding and platform oversight contracts.
 *
 * Onboarding is an account action: the caller is signed in, has no tenant context yet,
 * and becomes the first administrator of the workspace it creates. Platform oversight
 * crosses tenants and is restricted to the platform capability.
 */

export const organizationStatusSchema = z.enum(['ACTIVE', 'SUSPENDED']);
export type OrganizationStatus = z.infer<typeof organizationStatusSchema>;

export const createOrganizationRequestSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: slugSchema.optional(),
  timeZone: z.string().trim().min(1).max(64).default('Africa/Porto-Novo'),
  defaultLocale: localeSchema.default('fr'),
});

export type CreateOrganizationRequest = z.infer<typeof createOrganizationRequestSchema>;

export const organizationOnboardingResultSchema = z.object({
  organization: z.object({
    id: uuidSchema,
    slug: z.string(),
    name: z.string(),
    status: organizationStatusSchema,
    createdAt: z.string(),
  }),
  member: z.object({
    id: uuidSchema,
    roleId: uuidSchema,
    roleKey: z.string(),
    status: z.literal('ACTIVE'),
  }),
});

export type OrganizationOnboardingResult = z.infer<
  typeof organizationOnboardingResultSchema
>;

/** A platform administrator creates a workspace and assigns an existing account. */
export const createPlatformOrganizationRequestSchema = createOrganizationRequestSchema.extend({
  ownerEmail: emailSchema,
});

export type CreatePlatformOrganizationRequest = z.infer<
  typeof createPlatformOrganizationRequestSchema
>;

export const updateOrganizationStatusRequestSchema = z.object({
  status: organizationStatusSchema,
  reason: z.string().trim().max(500).optional(),
});

export type UpdateOrganizationStatusRequest = z.infer<
  typeof updateOrganizationStatusRequestSchema
>;

export const listPlatformOrganizationsQuerySchema = paginationQuerySchema
  .pick({ page: true, pageSize: true })
  .extend({
    status: organizationStatusSchema.optional(),
    search: z.string().trim().min(1).max(120).optional(),
  });

export type ListPlatformOrganizationsQuery = z.infer<
  typeof listPlatformOrganizationsQuerySchema
>;

export const platformOrganizationOverviewSchema = z.object({
  id: uuidSchema,
  slug: z.string(),
  name: z.string(),
  status: organizationStatusSchema,
  capabilityCount: z.number().int().min(0),
  memberCount: z.number().int().min(0),
  eventCount: z.number().int().min(0),
  registrationCount: z.number().int().min(0),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type PlatformOrganizationOverview = z.infer<
  typeof platformOrganizationOverviewSchema
>;

export const platformOrganizationMemberCountsSchema = z.object({
  total: z.number().int().min(0),
  active: z.number().int().min(0),
  invited: z.number().int().min(0),
  suspended: z.number().int().min(0),
});

export type PlatformOrganizationMemberCounts = z.infer<
  typeof platformOrganizationMemberCountsSchema
>;

export const platformOrganizationDetailSchema = platformOrganizationOverviewSchema.extend({
  members: platformOrganizationMemberCountsSchema,
});

export type PlatformOrganizationDetail = z.infer<
  typeof platformOrganizationDetailSchema
>;
