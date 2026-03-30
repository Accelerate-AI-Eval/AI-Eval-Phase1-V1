-- Add integrate_system_other to cots_buyer_assessments (next to integrate_system).
-- Stores free-text when user selects "Other (Specify Below)" for integration systems. Default NULL.

ALTER TABLE "cots_buyer_assessments"
  ADD COLUMN IF NOT EXISTS "integrate_system_other" varchar(300) DEFAULT NULL;

COMMENT ON COLUMN "cots_buyer_assessments"."integrate_system_other" IS 'Other integration systems (free text, max 300 chars) when integrate_system includes "Other (Specify Below)".';
