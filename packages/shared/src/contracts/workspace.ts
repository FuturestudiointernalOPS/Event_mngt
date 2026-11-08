import { z } from 'zod';
import { localeSchema, uuidSchema } from './common';

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Use at least 3 characters')
  .max(60, 'Use at most 60 characters')
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and single hyphens');

/**
 * Colours are stored as hex so they can be applied directly as CSS variables.
 * The API additionally checks contrast and returns a warning in `meta`.
 */
export const brandColorSchema = z
  .string()
  .trim()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Use a hex colour such as #173F5F');

export const colorModeSchema = z.enum(['light', 'dark']);

export const brandingSchema = z.object({
  primaryColor: brandColorSchema,
  secondaryColor: brandColorSchema,
  accentColor: brandColorSchema,
  backgroundColor: brandColorSchema,
  surfaceColor: brandColorSchema,
  textColor: brandColorSchema,
  colorMode: colorModeSchema,
  logoUrl: z.string().url().nullable(),
  logoDarkUrl: z.string().url().nullable(),
  faviconUrl: z.string().url().nullable(),
  borderRadius: z
    .string()
    .trim()
    .regex(/^\d+(?:\.\d+)?(?:px|rem)$/, 'Use a CSS length such as 0.5rem')
    .nullable(),
});

export type Branding = z.infer<typeof brandingSchema>;

export const DEFAULT_BRANDING: Branding = {
  primaryColor: '#173F5F',
  secondaryColor: '#206A8A',
  accentColor: '#F5A623',
  backgroundColor: '#FFFFFF',
  surfaceColor: '#F5F7FA',
  textColor: '#172B4D',
  colorMode: 'light',
  logoUrl: null,
  logoDarkUrl: null,
  faviconUrl: null,
  borderRadius: '0.5rem',
};

export const updateBrandingRequestSchema = brandingSchema.partial();

export type UpdateBrandingRequest = z.infer<typeof updateBrandingRequestSchema>;

export const workspaceProfileSchema = z.object({
  id: uuidSchema,
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  websiteUrl: z.string().url().nullable(),
  contactEmail: z.string().email().nullable(),
});

export type WorkspaceProfile = z.infer<typeof workspaceProfileSchema>;

export const workspaceSettingsSchema = z.object({
  defaultLocale: localeSchema,
  timeZone: z.string().min(1),
});

export type WorkspaceSettings = z.infer<typeof workspaceSettingsSchema>;

export const updateWorkspaceSettingsRequestSchema = workspaceSettingsSchema.partial().extend({
  name: z.string().trim().min(2).max(160).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  websiteUrl: z.string().url().nullable().optional(),
  contactEmail: z.string().email().nullable().optional(),
});

export type UpdateWorkspaceSettingsRequest = z.infer<
  typeof updateWorkspaceSettingsRequestSchema
>;

/**
 * Public workspace context: everything the SPA needs to render a tenant shell and to
 * apply branding. Contains no private data and is safe to cache at the edge per slug.
 */
export const workspaceContextSchema = z.object({
  organization: z.object({
    id: uuidSchema,
    slug: z.string(),
    name: z.string(),
  }),
  branding: brandingSchema,
  locale: z.object({
    default: localeSchema,
    supported: z.array(localeSchema),
  }),
});

export type WorkspaceContext = z.infer<typeof workspaceContextSchema>;

export const brandingContrastWarningSchema = z.object({
  pair: z.string(),
  ratio: z.number(),
  required: z.number(),
});

export type BrandingContrastWarning = z.infer<typeof brandingContrastWarningSchema>;
