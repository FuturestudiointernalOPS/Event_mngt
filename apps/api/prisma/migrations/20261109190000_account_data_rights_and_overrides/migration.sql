-- AlterEnum
ALTER TYPE "MeetingStatus" ADD VALUE 'CONFIRMED';

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "banner_url" TEXT,
ADD COLUMN     "brand_overrides" JSONB;

-- AlterTable
ALTER TABLE "people" ADD COLUMN     "erased_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "mfa_enabled_at" TIMESTAMP(3),
ADD COLUMN     "mfa_failed_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "mfa_last_step" BIGINT,
ADD COLUMN     "mfa_locked_until" TIMESTAMP(3),
ADD COLUMN     "mfa_recovery_hashes" TEXT[],
ADD COLUMN     "mfa_secret_enc" TEXT;

-- AlterTable
ALTER TABLE "workspace_settings" ADD COLUMN     "retention_months" INTEGER;

-- CreateTable
CREATE TABLE "platform_module_settings" (
    "module_key" TEXT NOT NULL,
    "available" BOOLEAN NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_module_settings_pkey" PRIMARY KEY ("module_key")
);

