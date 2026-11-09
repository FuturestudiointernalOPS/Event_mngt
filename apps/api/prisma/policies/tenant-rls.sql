-- ===========================================================================
-- Event Platform — tenant row-level security
-- ===========================================================================
-- Apply AFTER the Prisma migration that creates the tables, as the migration
-- owner. This file is the reference policy set; keep it in sync with the schema
-- whenever a tenant-owned table is added.
--
-- Idempotent: every policy is dropped and recreated, so re-running after a schema change is safe.
-- Run as:  psql "$DATABASE_URL" -f prisma/policies/tenant-rls.sql
--
-- Design notes (see docs/03-tenant-isolation-and-rls.md):
--   * The API connects as a NON-OWNER role (platform_app). Table owners bypass
--     RLS, so running the API as the owner silently disables this layer.
--   * Tenant context is set transaction-locally by TenantTransactionService:
--       SELECT set_config('app.current_organization_id', $1, true);
--     The `true` argument makes it transaction-scoped, so pooled connections
--     cannot leak one tenant's context into another request.
--   * nullif(current_setting(...), '') keeps an unset context safe: the
--     comparison yields NULL and zero rows are returned, never everything.
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
-- Helper expression, repeated inline so policies stay self-contained
--   organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- organizations — the tenant row itself is identified by id
-- ---------------------------------------------------------------------------
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organizations_tenant_isolation ON organizations;
CREATE POLICY organizations_tenant_isolation ON organizations
  USING (id = nullif(current_setting('app.current_organization_id', true), '')::uuid)
  WITH CHECK (id = nullif(current_setting('app.current_organization_id', true), '')::uuid);

-- ---------------------------------------------------------------------------
-- Direct organization_id tables
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Child tables without organization_id — scoped through a constrained parent.
-- Carrying organization_id directly is preferred; do it for new tables.
-- ---------------------------------------------------------------------------
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
-- Phase 2-5 tables: every one carries organization_id directly
-- ---------------------------------------------------------------------------
DO $do$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'organization_invitations', 'people', 'participant_categories', 'registration_fields',
    'registrations', 'consent_records', 'participant_profiles', 'innovations',
    'check_ins', 'meetings', 'introduction_requests', 'introduction_status_history'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_tenant_isolation', t);
    EXECUTE format(
      $f$CREATE POLICY %I ON %I
         USING (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid)
         WITH CHECK (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid)$f$,
      t || '_tenant_isolation', t);
  END LOOP;
END
$do$;

-- ---------------------------------------------------------------------------
-- Reads that must work BEFORE a tenant is known (SELECT only, permissive)
-- ---------------------------------------------------------------------------
-- Policies on one table are OR-ed per command, so these widen reads only. Writes
-- stay governed by the tenant policies above. Each one exposes only what the product
-- already publishes: the workspace identity and branding, published public events, and
-- a user's own membership rows.

DROP POLICY IF EXISTS organizations_public_read ON organizations;
CREATE POLICY organizations_public_read ON organizations
  FOR SELECT USING (status = 'ACTIVE');

DROP POLICY IF EXISTS workspace_branding_public_read ON workspace_branding;
CREATE POLICY workspace_branding_public_read ON workspace_branding
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM organizations o WHERE o.id = workspace_branding.organization_id AND o.status = 'ACTIVE'));

DROP POLICY IF EXISTS workspace_settings_public_read ON workspace_settings;
CREATE POLICY workspace_settings_public_read ON workspace_settings
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM organizations o WHERE o.id = workspace_settings.organization_id AND o.status = 'ACTIVE'));

DROP POLICY IF EXISTS events_public_read ON events;
CREATE POLICY events_public_read ON events
  FOR SELECT USING (
    visibility IN ('PUBLIC', 'UNLISTED')
    AND status NOT IN ('DRAFT', 'CANCELLED', 'ARCHIVED')
    AND EXISTS (SELECT 1 FROM organizations o WHERE o.id = events.organization_id AND o.status = 'ACTIVE'));

DROP POLICY IF EXISTS organization_members_own_read ON organization_members;
CREATE POLICY organization_members_own_read ON organization_members
  FOR SELECT USING (user_id = nullif(current_setting('app.current_user_id', true), '')::uuid);

DROP POLICY IF EXISTS organization_roles_member_read ON organization_roles;
CREATE POLICY organization_roles_member_read ON organization_roles
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM organization_members m
    WHERE m.role_id = organization_roles.id
      AND m.user_id = nullif(current_setting('app.current_user_id', true), '')::uuid));

DROP POLICY IF EXISTS role_permissions_member_read ON role_permissions;
CREATE POLICY role_permissions_member_read ON role_permissions
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM organization_members m
    WHERE m.role_id = role_permissions.role_id
      AND m.user_id = nullif(current_setting('app.current_user_id', true), '')::uuid));

-- ---------------------------------------------------------------------------
-- Platform administration (Super Admin console)
-- ---------------------------------------------------------------------------
-- TenantTransactionService.withPlatform() sets app.platform_admin = 'true' for one
-- transaction, and only after the caller's platform-administrator flag was verified in
-- the database. These policies are the only cross-tenant access the API role has.

DROP POLICY IF EXISTS organizations_platform_all ON organizations;
CREATE POLICY organizations_platform_all ON organizations
  USING (current_setting('app.platform_admin', true) = 'true')
  WITH CHECK (current_setting('app.platform_admin', true) = 'true');

DROP POLICY IF EXISTS events_platform_read ON events;
CREATE POLICY events_platform_read ON events
  FOR SELECT USING (current_setting('app.platform_admin', true) = 'true');

DROP POLICY IF EXISTS registrations_platform_read ON registrations;
CREATE POLICY registrations_platform_read ON registrations
  FOR SELECT USING (current_setting('app.platform_admin', true) = 'true');

-- ---------------------------------------------------------------------------
-- Deliberately NOT row-level secured
-- ---------------------------------------------------------------------------
-- users, user_sessions, verification_tokens and permissions are not
-- tenant-owned:
--   * permissions is a global catalogue, read-only to the API.
--   * identity tables are always queried by identifiers derived from a verified
--     session (user id from the access token, session by refresh-token hash).
--     They must be reachable before tenant context exists, so the compensating
--     control is the API layer: no endpoint accepts a user id or session id from
--     the client. This is documented in docs/03-tenant-isolation-and-rls.md.
--
-- If a future requirement needs database-level protection here, add policies
-- keyed on current_setting('app.current_user_id', true) and adjust the auth
-- bootstrap path deliberately.

-- ---------------------------------------------------------------------------
-- Verification queries (run manually, as platform_app)
-- ---------------------------------------------------------------------------
-- SELECT current_setting('app.current_organization_id', true);  -- empty
-- SELECT count(*) FROM events;                                   -- expect 0
-- BEGIN;
--   SELECT set_config('app.current_organization_id', '<tenant-a-uuid>', true);
--   SELECT count(*) FROM events;                                 -- tenant A only
-- COMMIT;
