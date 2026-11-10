import { z } from 'zod';
import { uuidSchema } from './common';

/**
 * Capability contracts shared by the API and the web app.
 *
 * The registry itself lives in `platform/capabilities.ts`; these shapes only describe
 * what a management response contains, so both sides decode the same structure.
 */

export const capabilityModuleKeySchema = z.enum([
  'organization',
  'events',
  'registrations',
  'participants',
  'profiles',
  'check_in',
  'meetings',
  'introductions',
  'reports',
  'platform',
]);

export const capabilityScopeSchema = z.enum([
  'organization',
  'membership',
  'both',
  'platform',
  'account',
]);

export const capabilityStatusSchema = z.enum(['active', 'deprecated']);

export const capabilityDefinitionViewSchema = z.object({
  key: z.string(),
  module: capabilityModuleKeySchema,
  name: z.string(),
  description: z.string(),
  scope: capabilityScopeSchema,
  requiresOrganizationEntitlement: z.boolean(),
  sensitive: z.boolean(),
  destructive: z.boolean(),
  dependsOn: z.array(z.string()),
  status: capabilityStatusSchema,
});

export type CapabilityDefinitionView = z.infer<typeof capabilityDefinitionViewSchema>;

export const capabilityModuleViewSchema = z.object({
  key: capabilityModuleKeySchema,
  name: z.string(),
  description: z.string(),
  capabilities: z.array(capabilityDefinitionViewSchema),
});

export type CapabilityModuleView = z.infer<typeof capabilityModuleViewSchema>;

export const capabilityCatalogueResponseSchema = z.object({
  modules: z.array(capabilityModuleViewSchema),
});

export type CapabilityCatalogueResponse = z.infer<typeof capabilityCatalogueResponseSchema>;

/**
 * One capability as seen by a manager.
 *
 * `organizationEntitled` says whether the organisation may use it at all;
 * `roleGranted` and `directGranted` say where the member's grant came from;
 * `effective` is the decision the API actually applies.
 */
export const capabilityAssignmentViewSchema = capabilityDefinitionViewSchema.extend({
  organizationEntitled: z.boolean(),
  roleGranted: z.boolean(),
  directGranted: z.boolean(),
  effective: z.boolean(),
  missingDependencies: z.array(z.string()),
});

export type CapabilityAssignmentView = z.infer<typeof capabilityAssignmentViewSchema>;

export const organizationCapabilitiesViewSchema = z.object({
  organization: z.object({
    id: uuidSchema,
    slug: z.string(),
    name: z.string(),
  }),
  capabilities: z.array(capabilityAssignmentViewSchema),
});

export type OrganizationCapabilitiesView = z.infer<
  typeof organizationCapabilitiesViewSchema
>;

export const platformOrganizationSummarySchema = z.object({
  id: uuidSchema,
  slug: z.string(),
  name: z.string(),
  status: z.enum(['ACTIVE', 'SUSPENDED']),
  capabilityCount: z.number().int(),
});

export type PlatformOrganizationSummary = z.infer<typeof platformOrganizationSummarySchema>;

export const memberCapabilitiesViewSchema = z.object({
  member: z.object({
    id: uuidSchema,
    userId: uuidSchema,
    email: z.string(),
    displayName: z.string().nullable(),
    roleId: uuidSchema,
    roleKey: z.string(),
    roleName: z.string(),
    status: z.enum(['INVITED', 'ACTIVE', 'SUSPENDED']),
  }),
  organizationCapabilities: z.array(z.string()),
  roleCapabilities: z.array(z.string()),
  directCapabilities: z.array(z.string()),
  effectiveCapabilities: z.array(z.string()),
  capabilities: z.array(capabilityAssignmentViewSchema),
});

export type MemberCapabilitiesView = z.infer<typeof memberCapabilitiesViewSchema>;

export const capabilityKeyParamSchema = z
  .string()
  .trim()
  .min(3)
  .max(80)
  .regex(/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/, 'Use a dotted capability key');

export type CapabilityKeyParam = z.infer<typeof capabilityKeyParamSchema>;
