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
-- Four scopes exist, and only TenantTransactionService sets them:
--   app.current_organization_id  an authenticated member inside one organisation,
--                                a public read for one organisation, or a capability
--                                operation scoped to a named organisation.
--   app.current_user_id          the caller's own identity, used to resolve a
--                                membership before tenant context exists.
--   app.platform_admin           a verified platform administrator. Only the
--                                organisation identity and capability tables opt in.
--   (public submission reuses the organisation scope; it is the only anonymous write.)
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

-- Organisation entitlements and direct member grants. Both carry organization_id so a
-- member of another tenant can never read or write them, even by guessing a uuid.
ALTER TABLE organization_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_capabilities FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS organization_capabilities_tenant_isolation ON organization_capabilities;
CREATE POLICY organization_capabilities_tenant_isolation ON organization_capabilities
  USING (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid);

ALTER TABLE member_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_capabilities FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS member_capabilities_tenant_isolation ON member_capabilities;
CREATE POLICY member_capabilities_tenant_isolation ON member_capabilities
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

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS invitations_tenant_isolation ON invitations;
CREATE POLICY invitations_tenant_isolation ON invitations
  USING (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid);

-- Idempotency records are infrastructure, but a stored response can contain tenant
-- data. A row with an organisation is visible only inside that tenant; an anonymous
-- row (no organisation) is the only kind reachable without tenant context.
ALTER TABLE idempotency_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_records FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS idempotency_records_tenant_isolation ON idempotency_records;
CREATE POLICY idempotency_records_tenant_isolation ON idempotency_records
  USING (
    organization_id IS NULL
    OR organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid
  )
  WITH CHECK (
    organization_id IS NULL
    OR organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid
  );

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
-- Wave 2 — registration, consent, badges and profiles
-- ---------------------------------------------------------------------------
-- Every wave 2 table carries organization_id directly, so the predicate stays
-- index-friendly instead of joining a parent. A public registration submission
-- writes these rows inside withOrganizationScope, resolved from the published
-- event slug; the API decides which rows a public route may write.

ALTER TABLE participant_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE participant_categories FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS participant_categories_tenant_isolation ON participant_categories;
CREATE POLICY participant_categories_tenant_isolation ON participant_categories
  USING (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid);

ALTER TABLE registration_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE registration_forms FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS registration_forms_tenant_isolation ON registration_forms;
CREATE POLICY registration_forms_tenant_isolation ON registration_forms
  USING (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid);

ALTER TABLE registration_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE registration_fields FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS registration_fields_tenant_isolation ON registration_fields;
CREATE POLICY registration_fields_tenant_isolation ON registration_fields
  USING (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid);

ALTER TABLE people ENABLE ROW LEVEL SECURITY;
ALTER TABLE people FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS people_tenant_isolation ON people;
CREATE POLICY people_tenant_isolation ON people
  USING (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid);

ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS registrations_tenant_isolation ON registrations;
CREATE POLICY registrations_tenant_isolation ON registrations
  USING (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid);

ALTER TABLE registration_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE registration_answers FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS registration_answers_tenant_isolation ON registration_answers;
CREATE POLICY registration_answers_tenant_isolation ON registration_answers
  USING (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid);

ALTER TABLE consent_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_documents FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS consent_documents_tenant_isolation ON consent_documents;
CREATE POLICY consent_documents_tenant_isolation ON consent_documents
  USING (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid);

ALTER TABLE consent_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_records FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS consent_records_tenant_isolation ON consent_records;
CREATE POLICY consent_records_tenant_isolation ON consent_records
  USING (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid);

ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE badges FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS badges_tenant_isolation ON badges;
CREATE POLICY badges_tenant_isolation ON badges
  USING (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid);

ALTER TABLE participant_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE participant_profiles FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS participant_profiles_tenant_isolation ON participant_profiles;
CREATE POLICY participant_profiles_tenant_isolation ON participant_profiles
  USING (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid);

ALTER TABLE organization_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_profiles FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS organization_profiles_tenant_isolation ON organization_profiles;
CREATE POLICY organization_profiles_tenant_isolation ON organization_profiles
  USING (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid);

ALTER TABLE innovations ENABLE ROW LEVEL SECURITY;
ALTER TABLE innovations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS innovations_tenant_isolation ON innovations;
CREATE POLICY innovations_tenant_isolation ON innovations
  USING (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid);

-- ---------------------------------------------------------------------------
-- Wave 4 — report exports
-- ---------------------------------------------------------------------------
-- An export is tenant data: it contains participant rows. The generated file is
-- readable only inside the organisation that requested it.

ALTER TABLE report_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_exports FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS report_exports_tenant_isolation ON report_exports;
CREATE POLICY report_exports_tenant_isolation ON report_exports
  USING (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid);

-- ---------------------------------------------------------------------------
-- Wave 3 — check-in, meetings and introductions
-- ---------------------------------------------------------------------------
-- Every wave 3 table carries organization_id directly, so the predicate stays
-- index-friendly instead of joining a parent. Introduction history is append-only;
-- the absence of an update/delete route is enforced by the API, not by the policy.

ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_ins FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS check_ins_tenant_isolation ON check_ins;
CREATE POLICY check_ins_tenant_isolation ON check_ins
  USING (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid);

ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS meetings_tenant_isolation ON meetings;
CREATE POLICY meetings_tenant_isolation ON meetings
  USING (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid);

ALTER TABLE introduction_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE introduction_requests FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS introduction_requests_tenant_isolation ON introduction_requests;
CREATE POLICY introduction_requests_tenant_isolation ON introduction_requests
  USING (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid);

ALTER TABLE introduction_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE introduction_status_history FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS introduction_status_history_tenant_isolation ON introduction_status_history;
CREATE POLICY introduction_status_history_tenant_isolation ON introduction_status_history
  USING (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid);

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

-- The caller must be able to read their own organisation entitlements and direct
-- grants while the membership is being resolved, before tenant context exists.
DROP POLICY IF EXISTS organization_capabilities_user_bootstrap ON organization_capabilities;
CREATE POLICY organization_capabilities_user_bootstrap ON organization_capabilities
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members m
      WHERE m.organization_id = organization_capabilities.organization_id
        AND m.user_id = nullif(current_setting('app.current_user_id', true), '')::uuid
    )
  );

DROP POLICY IF EXISTS member_capabilities_user_bootstrap ON member_capabilities;
CREATE POLICY member_capabilities_user_bootstrap ON member_capabilities
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members m
      WHERE m.id = member_capabilities.member_id
        AND m.user_id = nullif(current_setting('app.current_user_id', true), '')::uuid
    )
  );

-- Platform administrators deliberately cross tenants. The flag is set only by
-- TenantTransactionService.withPlatformAdmin, after the JWT guard has verified the
-- platform administrator claim, and it exposes organisation identity and capability
-- entitlements only — never tenant product data.
DROP POLICY IF EXISTS organizations_platform_admin_read ON organizations;
CREATE POLICY organizations_platform_admin_read ON organizations
  FOR SELECT
  USING (current_setting('app.platform_admin', true) = 'true');

-- Suspension and reactivation are organisation status changes. The guard has already
-- verified the platform administrator claim; the policy keeps the write meaningless for
-- any other transaction.
DROP POLICY IF EXISTS organizations_platform_admin_update ON organizations;
CREATE POLICY organizations_platform_admin_update ON organizations
  FOR UPDATE
  USING (current_setting('app.platform_admin', true) = 'true')
  WITH CHECK (current_setting('app.platform_admin', true) = 'true');

DROP POLICY IF EXISTS organization_capabilities_platform_admin ON organization_capabilities;
CREATE POLICY organization_capabilities_platform_admin ON organization_capabilities
  FOR ALL
  USING (current_setting('app.platform_admin', true) = 'true')
  WITH CHECK (current_setting('app.platform_admin', true) = 'true');

-- Platform support: read-only aggregate counts from tenant product tables. This is a
-- separate flag from app.platform_admin, set only by the dedicated support scope, so
-- entitlement management never widens into product data. Only the three tables the
-- support view counts opt in.
DROP POLICY IF EXISTS organization_members_platform_support_read ON organization_members;
CREATE POLICY organization_members_platform_support_read ON organization_members
  FOR SELECT
  USING (current_setting('app.platform_support', true) = 'true');

DROP POLICY IF EXISTS events_platform_support_read ON events;
CREATE POLICY events_platform_support_read ON events
  FOR SELECT
  USING (current_setting('app.platform_support', true) = 'true');

DROP POLICY IF EXISTS registrations_platform_support_read ON registrations;
CREATE POLICY registrations_platform_support_read ON registrations
  FOR SELECT
  USING (current_setting('app.platform_support', true) = 'true');

-- A signed-in user may record an audit row attributed to themselves when the action has
-- no organisation (sign-in, sign-out). Any other write is refused.
--
-- The read policy is not optional: an INSERT ... RETURNING also evaluates SELECT, and the
-- client returns the created row. Without it, the insert is rejected as a policy
-- violation even though the insert policy matches.
DROP POLICY IF EXISTS audit_logs_actor_read ON audit_logs;
CREATE POLICY audit_logs_actor_read ON audit_logs
  FOR SELECT
  USING (
    organization_id IS NULL
    AND actor_user_id = nullif(current_setting('app.current_user_id', true), '')::uuid
  );

DROP POLICY IF EXISTS audit_logs_actor_insert ON audit_logs;
CREATE POLICY audit_logs_actor_insert ON audit_logs
  FOR INSERT
  WITH CHECK (
    organization_id IS NULL
    AND actor_user_id = nullif(current_setting('app.current_user_id', true), '')::uuid
  );

-- An invited person can read and consume their own invitation before any tenant is
-- known. Identity is the account email, never a token supplied by the client.
DROP POLICY IF EXISTS invitations_recipient_read ON invitations;
CREATE POLICY invitations_recipient_read ON invitations
  FOR SELECT
  USING (
    email = (
      SELECT u.email FROM users u
      WHERE u.id = nullif(current_setting('app.current_user_id', true), '')::uuid
    )
  );

DROP POLICY IF EXISTS invitations_recipient_consume ON invitations;
CREATE POLICY invitations_recipient_consume ON invitations
  FOR UPDATE
  USING (
    email = (
      SELECT u.email FROM users u
      WHERE u.id = nullif(current_setting('app.current_user_id', true), '')::uuid
    )
  )
  WITH CHECK (
    email = (
      SELECT u.email FROM users u
      WHERE u.id = nullif(current_setting('app.current_user_id', true), '')::uuid
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
--   * rate_limit_counters holds only a hashed caller key, a window and a count, and
--     is never read by a product endpoint.
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
