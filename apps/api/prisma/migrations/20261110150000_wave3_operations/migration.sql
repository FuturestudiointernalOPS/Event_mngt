-- CreateEnum
CREATE TYPE "CheckInSource" AS ENUM ('ONLINE', 'OFFLINE', 'MANUAL');

-- CreateEnum
CREATE TYPE "MeetingStatus" AS ENUM ('PROPOSED', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "MeetingOutcome" AS ENUM ('MET', 'NO_SHOW', 'FOLLOW_UP');

-- CreateEnum
CREATE TYPE "IntroductionStatus" AS ENUM ('REQUESTED', 'ASSIGNED', 'INTRODUCED', 'DECLINED');

-- CreateEnum
CREATE TYPE "IntroductionOutcome" AS ENUM ('CONNECTED', 'FOLLOW_UP', 'NO_MATCH', 'DECLINED');

-- CreateTable
CREATE TABLE "check_ins" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "registration_id" UUID NOT NULL,
    "source" "CheckInSource" NOT NULL DEFAULT 'ONLINE',
    "scan_id" TEXT,
    "scanned_at" TIMESTAMP(3) NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checked_in_by_user_id" UUID,
    "device_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "check_ins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meetings" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "proposer_profile_id" UUID NOT NULL,
    "recipient_profile_id" UUID NOT NULL,
    "status" "MeetingStatus" NOT NULL DEFAULT 'PROPOSED',
    "requires_staff_confirmation" BOOLEAN NOT NULL DEFAULT true,
    "proposed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duration_minutes" INTEGER NOT NULL DEFAULT 30,
    "note" TEXT,
    "decided_at" TIMESTAMP(3),
    "decided_by_user_id" UUID,
    "outcome" "MeetingOutcome",
    "outcome_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meetings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "introduction_requests" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "requesting_profile_id" UUID NOT NULL,
    "reason" TEXT,
    "offered_help" TEXT,
    "status" "IntroductionStatus" NOT NULL DEFAULT 'REQUESTED',
    "assigned_to_user_id" UUID,
    "decided_at" TIMESTAMP(3),
    "decided_by_user_id" UUID,
    "outcome" "IntroductionOutcome",
    "outcome_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "introduction_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "introduction_status_history" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "from_status" "IntroductionStatus",
    "to_status" "IntroductionStatus" NOT NULL,
    "actor_user_id" UUID,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "introduction_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "check_ins_organization_id_event_id_scanned_at_idx" ON "check_ins"("organization_id", "event_id", "scanned_at");

-- CreateIndex
CREATE UNIQUE INDEX "check_ins_event_id_registration_id_key" ON "check_ins"("event_id", "registration_id");

-- CreateIndex
CREATE UNIQUE INDEX "check_ins_event_id_scan_id_key" ON "check_ins"("event_id", "scan_id");

-- CreateIndex
CREATE INDEX "meetings_organization_id_event_id_status_idx" ON "meetings"("organization_id", "event_id", "status");

-- CreateIndex
CREATE INDEX "meetings_organization_id_event_id_proposer_profile_id_idx" ON "meetings"("organization_id", "event_id", "proposer_profile_id");

-- CreateIndex
CREATE INDEX "meetings_organization_id_event_id_recipient_profile_id_idx" ON "meetings"("organization_id", "event_id", "recipient_profile_id");

-- CreateIndex
CREATE INDEX "introduction_requests_organization_id_event_id_status_idx" ON "introduction_requests"("organization_id", "event_id", "status");

-- CreateIndex
CREATE INDEX "introduction_history_scope_idx" ON "introduction_status_history"("organization_id", "event_id", "request_id", "created_at");

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_checked_in_by_user_id_fkey" FOREIGN KEY ("checked_in_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_proposer_profile_id_fkey" FOREIGN KEY ("proposer_profile_id") REFERENCES "participant_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_recipient_profile_id_fkey" FOREIGN KEY ("recipient_profile_id") REFERENCES "participant_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_decided_by_user_id_fkey" FOREIGN KEY ("decided_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "introduction_requests" ADD CONSTRAINT "introduction_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "introduction_requests" ADD CONSTRAINT "introduction_requests_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "introduction_requests" ADD CONSTRAINT "introduction_requests_requesting_profile_id_fkey" FOREIGN KEY ("requesting_profile_id") REFERENCES "participant_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "introduction_requests" ADD CONSTRAINT "introduction_requests_assigned_to_user_id_fkey" FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "introduction_requests" ADD CONSTRAINT "introduction_requests_decided_by_user_id_fkey" FOREIGN KEY ("decided_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "introduction_status_history" ADD CONSTRAINT "introduction_status_history_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "introduction_status_history" ADD CONSTRAINT "introduction_status_history_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "introduction_status_history" ADD CONSTRAINT "introduction_status_history_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "introduction_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "introduction_status_history" ADD CONSTRAINT "introduction_status_history_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
