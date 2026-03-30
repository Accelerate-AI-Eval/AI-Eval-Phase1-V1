-- Store the user who completed (or last updated) the vendor COTS assessment for "Completed by" display.

ALTER TABLE "cots_vendor_assessments"
  ADD COLUMN IF NOT EXISTS "user_id" integer DEFAULT NULL;

COMMENT ON COLUMN "cots_vendor_assessments"."user_id" IS 'User who completed or last updated this vendor COTS assessment.';
