-- Vendor COTS: add "other" free-text columns (default NULL).
-- customer_specific_risks_other: next to customer_specific_risks.
-- regulatory_requirements_other: next to regulatory_requirements.

ALTER TABLE "cots_vendor_assessments"
  ADD COLUMN IF NOT EXISTS "regulatory_requirements_other" varchar(300) DEFAULT NULL;

ALTER TABLE "cots_vendor_assessments"
  ADD COLUMN IF NOT EXISTS "customer_specific_risks_other" varchar(300) DEFAULT NULL;

COMMENT ON COLUMN "cots_vendor_assessments"."regulatory_requirements_other" IS 'Other regulatory requirements (free text, max 300 chars).';
COMMENT ON COLUMN "cots_vendor_assessments"."customer_specific_risks_other" IS 'Other customer-specific risks (free text, max 300 chars).';
