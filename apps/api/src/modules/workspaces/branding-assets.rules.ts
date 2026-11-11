/**
 * Workspace brand asset keys.
 *
 * The validation and hashing rules live in `common/uploads` because the event banner
 * uses the same ones; only the key layout is specific to workspace branding.
 */
export function brandingAssetKey(
  organizationId: string,
  kind: string,
  hash: string,
  extension: string,
): string {
  return `${organizationId}/branding/${kind}-${hash}.${extension}`;
}
