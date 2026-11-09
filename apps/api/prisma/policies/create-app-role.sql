-- ===========================================================================
-- Event Platform — runtime role
-- ===========================================================================
-- Creates the non-owner role the API must run as. Run once per environment, as the
-- owner (the same role that runs migrations):
--
--   npm run db:roles
--
-- Why it exists: PostgreSQL bypasses row-level security for the table owner, and
-- Supabase grants BYPASSRLS to its `postgres` role. Policies written for the owner
-- therefore never apply. This role has neither property.
--
-- No password is set here: the file is committed, credentials are not. In a deployed
-- environment, set one out of band:
--
--   ALTER ROLE platform_app LOGIN PASSWORD '<generated>';
--
-- and point the API at it with APP_DATABASE_URL. Migrations keep using DATABASE_URL
-- (the owner) because DDL is required.
--
-- The role is NOLOGIN in development so it can be exercised with SET ROLE without a
-- credential; grant it LOGIN only where a real deployment needs it.
-- ===========================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'platform_app') THEN
    CREATE ROLE platform_app NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;

  -- Lets the owner switch into the role for verification (`SET ROLE platform_app`).
  EXECUTE format('GRANT platform_app TO %I', current_user);
END
$$;

GRANT USAGE ON SCHEMA public TO platform_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO platform_app;

-- Tables created later by the migration owner inherit the same rights.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO platform_app;
