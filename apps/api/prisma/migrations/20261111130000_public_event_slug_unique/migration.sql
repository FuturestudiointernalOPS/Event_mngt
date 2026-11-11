-- A public event address is the slug alone (/e/:eventSlug), and the public lookup has no
-- workspace to disambiguate with. Two workspaces could therefore publish the same address
-- and the read picked one arbitrarily, which could show another organisation's event.
--
-- Make the slug unique across the platform so a public address resolves to exactly one
-- event. If this statement fails, two events already share a slug: rename one of them
-- before replaying. Refusing is the point — the alternative is a silent wrong answer.
DROP INDEX "events_organization_id_slug_key";
CREATE UNIQUE INDEX "events_slug_key" ON "events"("slug");
