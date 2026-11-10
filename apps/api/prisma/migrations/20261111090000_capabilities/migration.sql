-- CreateTable
CREATE TABLE "organization_capabilities" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "capability_key" TEXT NOT NULL,
    "assigned_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_capabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_capabilities" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "capability_key" TEXT NOT NULL,
    "assigned_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_capabilities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organization_capabilities_organization_id_capability_key_key" ON "organization_capabilities"("organization_id", "capability_key");

-- CreateIndex
CREATE INDEX "organization_capabilities_capability_key_idx" ON "organization_capabilities"("capability_key");

-- CreateIndex
CREATE UNIQUE INDEX "member_capabilities_organization_id_member_id_capability_ke_key" ON "member_capabilities"("organization_id", "member_id", "capability_key");

-- CreateIndex
CREATE INDEX "member_capabilities_organization_id_member_id_idx" ON "member_capabilities"("organization_id", "member_id");

-- AddForeignKey
ALTER TABLE "organization_capabilities" ADD CONSTRAINT "organization_capabilities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_capabilities" ADD CONSTRAINT "organization_capabilities_assigned_by_user_id_fkey" FOREIGN KEY ("assigned_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_capabilities" ADD CONSTRAINT "member_capabilities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_capabilities" ADD CONSTRAINT "member_capabilities_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "organization_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_capabilities" ADD CONSTRAINT "member_capabilities_assigned_by_user_id_fkey" FOREIGN KEY ("assigned_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: every existing organisation has been using role permissions alone, so it
-- keeps every organisation-scoped capability. Member access is still constrained by the
-- capabilities derived from each role, which reproduces the previous behaviour exactly.
-- Platform administrators may later revoke entitlements individually.
INSERT INTO "organization_capabilities" ("id", "organization_id", "capability_key")
SELECT gen_random_uuid(), organizations."id", capability."key"
FROM "organizations"
CROSS JOIN (
    VALUES
        ('organization.view'),
        ('organization.edit'),
        ('organization.manage_branding'),
        ('organization.view_members'),
        ('organization.invite_members'),
        ('organization.remove_members'),
        ('organization.manage_permissions'),
        ('organization.view_audit_log'),
        ('events.view'),
        ('events.create'),
        ('events.publish'),
        ('events.view_modules'),
        ('events.manage_modules'),
        ('editions.view'),
        ('editions.create'),
        ('registrations.view'),
        ('registrations.approve'),
        ('registrations.reject'),
        ('registrations.erase'),
        ('registrations.view_categories'),
        ('registrations.manage_categories'),
        ('registrations.view_form'),
        ('registrations.manage_form'),
        ('registrations.view_consent'),
        ('registrations.manage_consent'),
        ('registrations.view_badges'),
        ('registrations.manage_badges'),
        ('participants.view'),
        ('profiles.view'),
        ('profiles.edit'),
        ('profiles.moderate'),
        ('check_in.view'),
        ('check_in.operate'),
        ('meetings.view'),
        ('meetings.manage'),
        ('introductions.view'),
        ('introductions.manage'),
        ('reports.view'),
        ('reports.export')
) AS capability("key")
ON CONFLICT ("organization_id", "capability_key") DO NOTHING;
