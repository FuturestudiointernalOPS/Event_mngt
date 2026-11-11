ALTER TABLE "workspace_settings" ADD COLUMN "retention_months" INTEGER;
ALTER TABLE "workspace_settings" ADD CONSTRAINT "workspace_settings_retention_months_check" CHECK ("retention_months" IS NULL OR ("retention_months" BETWEEN 1 AND 120));
