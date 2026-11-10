-- CreateEnum
CREATE TYPE "ExportKind" AS ENUM ('REGISTRATIONS');

-- CreateEnum
CREATE TYPE "ExportFormat" AS ENUM ('CSV', 'PDF');

-- CreateEnum
CREATE TYPE "ExportStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "report_exports" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "requested_by_user_id" UUID,
    "kind" "ExportKind" NOT NULL DEFAULT 'REGISTRATIONS',
    "format" "ExportFormat" NOT NULL,
    "status" "ExportStatus" NOT NULL DEFAULT 'PENDING',
    "file_name" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "content" BYTEA,
    "row_count" INTEGER NOT NULL DEFAULT 0,
    "byte_size" INTEGER NOT NULL DEFAULT 0,
    "truncated" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "report_exports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "report_exports_organization_id_created_at_idx" ON "report_exports"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "report_exports_organization_id_status_idx" ON "report_exports"("organization_id", "status");

-- AddForeignKey
ALTER TABLE "report_exports" ADD CONSTRAINT "report_exports_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_exports" ADD CONSTRAINT "report_exports_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_exports" ADD CONSTRAINT "report_exports_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
