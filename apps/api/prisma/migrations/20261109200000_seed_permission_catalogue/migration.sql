-- The permission catalogue is reference data every organisation's roles depend on, so it
-- ships with the schema instead of relying on a manual seed. Idempotent: re-running adds
-- only keys that are missing. Adding a permission to packages/shared requires a new
-- migration like this one (a test fails otherwise).
INSERT INTO "permissions" ("id", "key") VALUES
  (gen_random_uuid(), 'audit:read'),
  (gen_random_uuid(), 'checkin:operate'),
  (gen_random_uuid(), 'checkin:read'),
  (gen_random_uuid(), 'event:manage'),
  (gen_random_uuid(), 'event:publish'),
  (gen_random_uuid(), 'event:read'),
  (gen_random_uuid(), 'introduction:manage'),
  (gen_random_uuid(), 'introduction:read'),
  (gen_random_uuid(), 'meeting:manage'),
  (gen_random_uuid(), 'meeting:read'),
  (gen_random_uuid(), 'member:manage'),
  (gen_random_uuid(), 'member:read'),
  (gen_random_uuid(), 'module:manage'),
  (gen_random_uuid(), 'participant:read'),
  (gen_random_uuid(), 'platform:modules'),
  (gen_random_uuid(), 'platform:organizations'),
  (gen_random_uuid(), 'profile:moderate'),
  (gen_random_uuid(), 'profile:read'),
  (gen_random_uuid(), 'registration:manage'),
  (gen_random_uuid(), 'registration:read'),
  (gen_random_uuid(), 'report:export'),
  (gen_random_uuid(), 'report:read'),
  (gen_random_uuid(), 'workspace:manage'),
  (gen_random_uuid(), 'workspace:read')
ON CONFLICT ("key") DO NOTHING;
