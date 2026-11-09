-- Public event URLs are /e/:eventSlug, so a slug must identify one event platform-wide.
CREATE UNIQUE INDEX "events_slug_key" ON "events"("slug");
