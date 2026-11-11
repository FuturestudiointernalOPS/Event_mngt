-- Public event URLs are /e/:eventSlug, so a slug must identify exactly one event on the whole
-- platform. Until now it was unique only per organisation, which let a public registration
-- resolve to another organisation's event with the same slug.

-- 1. Rename later duplicates (keep the oldest) so the unique index can be created.
UPDATE "events" e
SET "slug" = e."slug" || '-' || substr(md5(e."id"::text), 1, 6)
FROM (
  SELECT "id", row_number() OVER (PARTITION BY "slug" ORDER BY "created_at", "id") AS rn
  FROM "events"
) d
WHERE e."id" = d."id" AND d.rn > 1;

-- 2. One slug, one event.
CREATE UNIQUE INDEX "events_slug_key" ON "events"("slug");

-- 3. Row-level security hides other organisations' events, so the application cannot check
--    for a free slug itself. This function answers only "is this slug taken?" (a boolean,
--    no row data) with the owner's rights, and nothing else.
CREATE OR REPLACE FUNCTION event_slug_taken(candidate text) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
  $$ SELECT EXISTS (SELECT 1 FROM events WHERE slug = candidate) $$;

REVOKE ALL ON FUNCTION event_slug_taken(text) FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'platform_app') THEN
    GRANT EXECUTE ON FUNCTION event_slug_taken(text) TO platform_app;
  END IF;
END
$$;
