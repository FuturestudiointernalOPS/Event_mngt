-- Event-level appearance: one banner and up to three colour overrides.
-- NULL means "inherit the workspace branding", so no backfill is needed: every existing
-- event keeps inheriting until someone sets a value.
ALTER TABLE "events"
  ADD COLUMN "banner_url" TEXT,
  ADD COLUMN "brand_primary_color" TEXT,
  ADD COLUMN "brand_secondary_color" TEXT,
  ADD COLUMN "brand_accent_color" TEXT;
