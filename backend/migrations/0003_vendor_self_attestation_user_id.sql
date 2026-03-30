-- Add user_id to vendor_self_attestations for fetch/upsert by logged-in vendor
ALTER TABLE "vendor_self_attestations" ADD COLUMN IF NOT EXISTS "user_id" integer;
ALTER TABLE "vendor_self_attestations" ALTER COLUMN "assessment_id" DROP NOT NULL;
-- Index on user_id for lookups (non-unique so migration passes when duplicates exist)
CREATE INDEX IF NOT EXISTS "vendor_self_attestations_user_id_idx"
  ON "vendor_self_attestations" ("user_id") WHERE "user_id" IS NOT NULL;
