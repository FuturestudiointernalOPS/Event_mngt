import { z } from 'zod';
import { brandingContrastWarningSchema, brandingSchema } from './workspace';

/**
 * Brand asset uploads.
 *
 * The route kind is part of the URL, so an unknown kind is rejected before any bytes
 * are read. The response returns the stored URL and the branding it produced.
 * See WP-07.
 */

export const brandingAssetKindSchema = z.enum(['logo', 'logoDark', 'favicon']);

export type BrandingAssetKind = z.infer<typeof brandingAssetKindSchema>;

export const brandingAssetUploadResultSchema = z.object({
  url: z.url(),
  kind: brandingAssetKindSchema,
  branding: brandingSchema,
  contrastWarnings: z.array(brandingContrastWarningSchema),
});

export type BrandingAssetUploadResult = z.infer<typeof brandingAssetUploadResultSchema>;
