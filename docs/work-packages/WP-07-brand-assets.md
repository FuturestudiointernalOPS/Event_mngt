# WP-07 — Brand asset uploads

**Wave** 1 · **Parallel-safe** yes
**Owns** `apps/api/src/integrations/storage/**`, `apps/api/src/modules/workspaces/**`
**Depends on** WP-01

## Goal

An organisation can upload its logo and favicon and see them applied, on a real provider and
not a placeholder.

## Contract

| Route | Permission | Behaviour |
| --- | --- | --- |
| `POST /workspaces/:slug/branding/assets/:kind` | `workspace:manage` | upload `logo`, `logoDark` or `favicon` |

Response returns the stored URL, which the existing branding update already accepts. Colour
tokens and contrast warnings are untouched by this package.

## Rules

- **Allowlist, not blocklist.** `image/png`, `image/jpeg`, `image/webp` only. SVG is refused:
  it can carry script and would be served from the same origin.
- Maximum 2 MB. Enforced before the bytes reach the provider, not after.
- The declared content type is not trusted alone; check the magic bytes of the first chunk.
- Object key is derived from the organisation and a content hash —
  `<orgId>/branding/<kind>-<hash>.<ext>` — so a re-upload of the same file is idempotent and a
  different file never overwrites the old one silently.
- No local disk, no temporary files. Stream to the provider.
- The console adapter stays the default in development and returns a deterministic local URL,
  so the flow is testable without credentials.
- The bucket stays private; the stored value is the provider's URL, not an internal key, and
  no credentials appear in a response.

## Acceptance (each becomes a test)

1. Each allowed type is accepted; SVG and PDF are refused.
2. A file above the limit is refused before upload.
3. A file whose bytes contradict its declared type is refused.
4. Uploading the same file twice yields the same key; a different file yields a different key.
5. The stored URL is persisted on the branding row and returned by the workspace context.
6. Contrast warnings are unaffected.
7. With the console adapter and no credentials, the flow still works.

## Integration requests to the pre-flight

- Storage configuration is already in the environment contract (`S3_*`,
  `STORAGE_PROVIDER`); confirm it validates and document the bucket policy requirement.
- If a real provider SDK is required, raise the dependency for approval — do not install it
  yourself.

## Out of scope

Image resizing, CDN invalidation, and uploading event-level branding (Phase 2).

## Handover

- Implemented as `branding-assets.controller.ts`-equivalent route on `WorkspacesController`,
  plus `branding-assets.service.ts` and `branding-assets.rules.ts` in `modules/workspaces/`.
- `POST /workspaces/:slug/branding/assets/:kind` accepts `logo`, `logoDark` and `favicon`.
  PNG/JPEG/WebP are allowed; SVG is refused. Size and magic bytes are checked in memory
  before `StoragePort.upload` is called.
- Object keys are content-addressed (`<org>/branding/<kind>-<hash>.<ext>`); the stored URL
  is written to `workspace_branding` and returned by the workspace context.
- Risk: `StoragePort` accepts a `Buffer`, so a real S3 adapter should stream from that buffer
  rather than the port accepting a stream. The console adapter is the default and is covered
  by the service spec. The upload happens before the branding row is written, so a database
  failure can leave an unreferenced object; a periodic bucket reconciliation is a follow-up.
