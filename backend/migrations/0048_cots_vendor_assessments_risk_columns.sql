-- Add risk-related columns to cots_vendor_assessments (required by schema and saveVendorCotsDraft).

ALTER TABLE "cots_vendor_assessments" ADD COLUMN IF NOT EXISTS "identified_risks" text;
ALTER TABLE "cots_vendor_assessments" ADD COLUMN IF NOT EXISTS "risk_domain_scores" text;
ALTER TABLE "cots_vendor_assessments" ADD COLUMN IF NOT EXISTS "contextual_multipliers" text;
ALTER TABLE "cots_vendor_assessments" ADD COLUMN IF NOT EXISTS "risk_mitigation" text;
