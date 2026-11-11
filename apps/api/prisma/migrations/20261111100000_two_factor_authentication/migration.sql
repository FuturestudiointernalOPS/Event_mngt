-- Two-factor authentication (TOTP) state on the account.
-- The recovery-code array is NOT NULL with an empty default so existing accounts and new
-- accounts always have a usable list.
ALTER TABLE "users"
  ADD COLUMN "mfa_secret_enc" TEXT,
  ADD COLUMN "mfa_enabled_at" TIMESTAMP(3),
  ADD COLUMN "mfa_last_step" BIGINT,
  ADD COLUMN "mfa_recovery_hashes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "mfa_failed_attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "mfa_locked_until" TIMESTAMP(3);
