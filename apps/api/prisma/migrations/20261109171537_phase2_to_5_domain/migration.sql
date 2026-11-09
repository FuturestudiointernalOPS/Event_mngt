-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FieldType" AS ENUM ('TEXT', 'EMAIL', 'PHONE', 'SELECT', 'RADIO', 'CHECKBOX', 'TEXTAREA');

-- CreateEnum
CREATE TYPE "ProfileStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CheckInSource" AS ENUM ('ONLINE', 'OFFLINE', 'MANUAL');

-- CreateEnum
CREATE TYPE "MeetingStatus" AS ENUM ('PROPOSED', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "IntroductionStatus" AS ENUM ('SUBMITTED', 'IN_REVIEW', 'APPROVED', 'DECLINED', 'INTRODUCED', 'CLOSED');

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "consent_text" TEXT,
ADD COLUMN     "consent_version" TEXT NOT NULL DEFAULT '1';

-- CreateTable
CREATE TABLE "organization_invitations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "role_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "invited_by_user_id" UUID NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "people" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "phone" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "people_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participant_categories" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "requires_approval" BOOLEAN NOT NULL DEFAULT false,
    "capacity" INTEGER,
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "participant_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registration_fields" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "category_id" UUID,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "FieldType" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "options" JSONB,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registration_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registrations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "person_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "answers" JSONB NOT NULL DEFAULT '{}',
    "access_token_hash" TEXT NOT NULL,
    "idempotency_key" TEXT,
    "decided_at" TIMESTAMP(3),
    "decided_by_user_id" UUID,
    "decision_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_records" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "registration_id" UUID NOT NULL,
    "purpose" TEXT NOT NULL,
    "policy_version" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participant_profiles" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "registration_id" UUID NOT NULL,
    "headline" TEXT NOT NULL,
    "bio" TEXT,
    "tags" TEXT[],
    "is_visible" BOOLEAN NOT NULL DEFAULT false,
    "status" "ProfileStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "participant_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "innovations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "owner_registration_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "sector" TEXT,
    "tags" TEXT[],
    "is_visible" BOOLEAN NOT NULL DEFAULT false,
    "status" "ProfileStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "innovations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "check_ins" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "registration_id" UUID NOT NULL,
    "scanned_at" TIMESTAMP(3) NOT NULL,
    "source" "CheckInSource" NOT NULL,
    "client_scan_id" TEXT,
    "scanned_by_user_id" UUID,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "check_ins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meetings" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "proposer_registration_id" UUID NOT NULL,
    "invitee_registration_id" UUID NOT NULL,
    "message" TEXT,
    "proposed_start" TIMESTAMP(3),
    "proposed_end" TIMESTAMP(3),
    "location" TEXT,
    "status" "MeetingStatus" NOT NULL DEFAULT 'PROPOSED',
    "responded_at" TIMESTAMP(3),
    "outcome" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meetings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "introduction_requests" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "innovation_id" UUID NOT NULL,
    "requester_registration_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "help_offered" TEXT NOT NULL,
    "status" "IntroductionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "assigned_to_user_id" UUID,
    "decision_note" TEXT,
    "outcome" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "introduction_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "introduction_status_history" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "from_status" "IntroductionStatus",
    "to_status" "IntroductionStatus" NOT NULL,
    "changed_by_user_id" UUID,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "introduction_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organization_invitations_token_hash_key" ON "organization_invitations"("token_hash");

-- CreateIndex
CREATE INDEX "organization_invitations_organization_id_email_idx" ON "organization_invitations"("organization_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "people_organization_id_email_key" ON "people"("organization_id", "email");

-- CreateIndex
CREATE INDEX "participant_categories_organization_id_idx" ON "participant_categories"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "participant_categories_event_id_key_key" ON "participant_categories"("event_id", "key");

-- CreateIndex
CREATE INDEX "registration_fields_organization_id_idx" ON "registration_fields"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "registration_fields_event_id_key_key" ON "registration_fields"("event_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "registrations_access_token_hash_key" ON "registrations"("access_token_hash");

-- CreateIndex
CREATE INDEX "registrations_organization_id_event_id_status_idx" ON "registrations"("organization_id", "event_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "registrations_event_id_person_id_key" ON "registrations"("event_id", "person_id");

-- CreateIndex
CREATE UNIQUE INDEX "registrations_event_id_idempotency_key_key" ON "registrations"("event_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "consent_records_organization_id_registration_id_idx" ON "consent_records"("organization_id", "registration_id");

-- CreateIndex
CREATE UNIQUE INDEX "participant_profiles_registration_id_key" ON "participant_profiles"("registration_id");

-- CreateIndex
CREATE INDEX "participant_profiles_organization_id_event_id_status_idx" ON "participant_profiles"("organization_id", "event_id", "status");

-- CreateIndex
CREATE INDEX "innovations_organization_id_event_id_status_idx" ON "innovations"("organization_id", "event_id", "status");

-- CreateIndex
CREATE INDEX "check_ins_organization_id_event_id_idx" ON "check_ins"("organization_id", "event_id");

-- CreateIndex
CREATE UNIQUE INDEX "check_ins_event_id_registration_id_key" ON "check_ins"("event_id", "registration_id");

-- CreateIndex
CREATE UNIQUE INDEX "check_ins_event_id_client_scan_id_key" ON "check_ins"("event_id", "client_scan_id");

-- CreateIndex
CREATE INDEX "meetings_organization_id_event_id_status_idx" ON "meetings"("organization_id", "event_id", "status");

-- CreateIndex
CREATE INDEX "meetings_proposer_registration_id_idx" ON "meetings"("proposer_registration_id");

-- CreateIndex
CREATE INDEX "meetings_invitee_registration_id_idx" ON "meetings"("invitee_registration_id");

-- CreateIndex
CREATE INDEX "introduction_requests_organization_id_event_id_status_idx" ON "introduction_requests"("organization_id", "event_id", "status");

-- CreateIndex
CREATE INDEX "introduction_status_history_request_id_idx" ON "introduction_status_history"("request_id");

-- AddForeignKey
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "organization_roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "people" ADD CONSTRAINT "people_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participant_categories" ADD CONSTRAINT "participant_categories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participant_categories" ADD CONSTRAINT "participant_categories_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_fields" ADD CONSTRAINT "registration_fields_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_fields" ADD CONSTRAINT "registration_fields_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_fields" ADD CONSTRAINT "registration_fields_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "participant_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "participant_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participant_profiles" ADD CONSTRAINT "participant_profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participant_profiles" ADD CONSTRAINT "participant_profiles_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "innovations" ADD CONSTRAINT "innovations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "innovations" ADD CONSTRAINT "innovations_owner_registration_id_fkey" FOREIGN KEY ("owner_registration_id") REFERENCES "registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "introduction_requests" ADD CONSTRAINT "introduction_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "introduction_requests" ADD CONSTRAINT "introduction_requests_innovation_id_fkey" FOREIGN KEY ("innovation_id") REFERENCES "innovations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "introduction_status_history" ADD CONSTRAINT "introduction_status_history_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "introduction_status_history" ADD CONSTRAINT "introduction_status_history_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "introduction_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
