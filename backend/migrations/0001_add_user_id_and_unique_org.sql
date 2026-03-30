-- Add user_id to vendor_onboarding and buyer_onboarding; one onboarding per org (unique on organization_id).
-- Existing rows: user_id is nullable until backfilled; new inserts from app will set user_id.

ALTER TABLE "vendor_onboarding" ADD COLUMN IF NOT EXISTS "user_id" integer;
--> statement-breakpoint
ALTER TABLE "buyer_onboarding" ADD COLUMN IF NOT EXISTS "user_id" integer;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "vendor_onboarding_organization_id_unique" ON "vendor_onboarding" ("organization_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "buyer_onboarding_organization_id_unique" ON "buyer_onboarding" ("organization_id");
