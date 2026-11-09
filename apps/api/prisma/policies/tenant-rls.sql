-- ===========================================================================
-- Event Platform — tenant row-level security
-- ===========================================================================
-- Apply AFTER the Prisma migration that creates the tables, as the migration
-- owner. This file is the reference policy set; keep it in sync with the schema
-- whenever a tenant-owned table is added. `npm run check:policies` (the policy
-- coverage test) fails when a tenant-owned model has no policy here.
--
-- Run as:  npm run db:policies       (or: psql "$DATABASE_URL" -f this file)
-- The file is idempotent: every policy is dropped before it is created.
--
-- Three scopes exist, and only TenantTransactionService sets them:
--   app.current_organization_id  an authenticated member inside one organisation,
--                                or a public read for one organisation.
--   app.current_user_id          the caller's own identity, used to resolve a
--                                membership before tenant context exists.
-- See docs/03-tenant-isolation-and-rls.md and WP-01.
--
-- Design notes:
--   * The API should connect as a NON-OWNER role (platform_app). FORCE below makes
--     the policies apply to the owner too, so a misconfigured role cannot silently
--     disable this layer, but least privilege is still the target.
--   * Context is transaction-local (`set_config(..., true)`), so a pooled
--     connection cannot leak one tenant's context into another request.
--   * nullif(current_setting(...), '') keeps an unset context safe: the comparison
--     yields NULL and zero rows are returned, never everything.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Runtime role (do this once per environment, not per migration)
-- ---------------------------------------------------------------------------
-- CREATE ROLE platform_app LOGIN PASSWORD '<generated>';
-- GRANT CONNECT ON DATABASE postgres TO platform_app;
-- GRANT USAGE ON SCHEMA public TO platform_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO platform_app;
-- ALTER DEFAULT PRIVILEGES IN SCHEMA public
--   GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO platform_app;
-- The API must NOT be granted BYPASSRLS or table ownership.

-- ---------------------------------------------------------------------------
-- Tenant isolation — the default for every tenant-owned table
-- ---------------------------------------------------------------------------
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS organizations_tenant_isolation ON organizations;
CREATE POLICY organizations_tenant_isolation ON organizations
  USING (id = nullif(current_setting('app.current_organization_id', true), '')::uuid)
  WITH CHECK (id = nullif(current_setting('app.current_organization_id', true), '')::uuid);

ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS organization_members_tenant_isolation ON organization_members;
CREATE POLICY organization_members_tenant_isolation ON organization_members
  USING (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid);

ALTER TABLE organization_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_roles FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS organization_roles_tenant_isolation ON organization_roles;
CREATE POLICY organization_roles_tenant_isolation ON organization_roles
  USING (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid);

ALTER TABLE workspace_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_settings FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspace_settings_tenant_isolation ON workspace_settings;
CREATE POLICY workspace_settings_tenant_isolation ON workspace_settings
  USING (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid);

ALTER TABLE workspace_branding ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_branding FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspace_branding_tenant_isolation ON workspace_branding;
CREATE POLICY workspace_branding_tenant_isolation ON workspace_branding
  USING (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS events_tenant_isolation ON events;
CREATE POLICY events_tenant_isolation ON events
  USING (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_logs_tenant_isolation ON audit_logs;
CREATE POLICY audit_logs_tenant_isolation ON audit_logs
  USING (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid);

-- Child tables without organization_id — scoped through a constrained parent.
-- Carrying organization_id directly is preferred; do it for new tables.
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS role_permissions_tenant_isolation ON role_permissions;
CREATE POLICY role_permissions_tenant_isolation ON role_permissions
  USING (
    EXISTS (
      SELECT 1 FROM organization_roles r
      WHERE r.id = role_permissions.role_id
        AND r.organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_roles r
      WHERE r.id = role_permissions.role_id
        AND r.organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid
    )
  );

ALTER TABLE event_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_modules FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS event_modules_tenant_isolation ON event_modules;
CREATE POLICY event_modules_tenant_isolation ON event_modules
  USING (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_modules.event_id
        AND e.organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_modules.event_id
        AND e.organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid
    )
  );

-- ---------------------------------------------------------------------------
-- Bootstrap scope — resolve a membership before tenant context exists
-- ---------------------------------------------------------------------------
-- Read-only. A caller can see their own membership rows and the organisation and
-- role rows reachable from them, and nothing else. Permissive policies are OR-ed
-- with the tenant policies above, so this adds access without weakening them.
DROP POLICY IF EXISTS organization_members_user_bootstrap ON organization_members;
CREATE POLICY organization_members_user_bootstrap ON organization_members
  FOR SELECT
  USING (user_id = nullif(current_setting('app.current_user_id', true), '')::uuid);

DROP POLICY IF EXISTS organizations_user_bootstrap ON organizations;
CREATE POLICY organizations_user_bootstrap ON organizations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members m
      WHERE m.organization_id = organizations.id
        AND m.user_id = nullif(current_setting('app.current_user_id', true), '')::uuid
    )
  );

DROP POLICY IF EXISTS organization_roles_user_bootstrap ON organization_roles;
CREATE POLICY organization_roles_user_bootstrap ON organization_roles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members m
      WHERE m.organization_id = organization_roles.organization_id
        AND m.user_id = nullif(current_setting('app.current_user_id', true), '')::uuid
    )
  );

DROP POLICY IF EXISTS role_permissions_user_bootstrap ON role_permissions;
CREATE POLICY role_permissions_user_bootstrap ON role_permissions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_roles r
      JOIN organization_members m ON m.organization_id = r.organization_id
      WHERE r.id = role_permissions.role_id
        AND m.user_id = nullif(current_setting('app.current_user_id', true), '')::uuid
    )
  );

-- ---------------------------------------------------------------------------
-- Public read — what an anonymous visitor is allowed to see
-- ---------------------------------------------------------------------------
-- An active organisation's identity (id, slug, name, status) is public by design:
-- it is what a workspace page is built from. Settings and branding stay protected
-- and are read inside the public organisation scope after the slug is resolved.
DROP POLICY IF EXISTS organizations_public_read ON organizations;
CREATE POLICY organizations_public_read ON organizations
  FOR SELECT
  USING (status = 'ACTIVE');

-- A published event is public by intent. Private, draft, cancelled and archived
-- events remain invisible without tenant context. Writes still require the tenant
-- predicate, because these policies are SELECT-only.
DROP POLICY IF EXISTS events_public_read ON events;
CREATE POLICY events_public_read ON events
  FOR SELECT
  USING (
    visibility IN ('PUBLIC', 'UNLISTED')
    AND status NOT IN ('DRAFT', 'CANCELLED', 'ARCHIVED')
  );

-- ---------------------------------------------------------------------------
-- Deliberately NOT row-level secured
-- ---------------------------------------------------------------------------
-- users, user_sessions, verification_tokens and permissions are not tenant-owned:
--   * permissions is a global catalogue, read-only to the API.
--   * identity tables are always queried by identifiers derived from a verified
--     session (user id from the access token, session by refresh-token hash).
--     They must be reachable before any context exists, so the compensating
--     control is the API layer: no endpoint accepts a user id or session id from
--     the client. This is documented in docs/03-tenant-isolation-and-rls.md.

-- ---------------------------------------------------------------------------
-- Verification queries (run manually, as the application role)
-- ---------------------------------------------------------------------------
-- SELECT current_setting('app.current_organization_id', true);  -- empty
-- SELECT count(*) FROM events;                                   -- only published ones
-- SELECT count(*) FROM workspace_settings;                       -- expect 0
--
-- BEGIN;
--   SELECT set_config('app.current_user_id', '<user-uuid>', true);
--   SELECT count(*) FROM organization_members;                   -- only that user's rows
--   SELECT count(*) FROM organizations;                          -- their organisations only
-- COMMIT;
--
-- BEGIN;
--   SELECT set_config('app.current_organization_id', '<tenant-a-uuid>', true);
--   SELECT count(*) FROM events;                                 -- tenant A only
-- COMMIT;
