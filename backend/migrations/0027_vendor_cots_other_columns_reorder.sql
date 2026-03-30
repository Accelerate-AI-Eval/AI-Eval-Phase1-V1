-- Place regulatory_requirements_other next to regulatory_requirements and
-- customer_specific_risks_other next to customer_specific_risks by recreating the table.

-- Step 1: Ensure columns exist (idempotent if 0026 already ran)
ALTER TABLE "cots_vendor_assessments"
  ADD COLUMN IF NOT EXISTS "regulatory_requirements_other" varchar(300) DEFAULT NULL;
ALTER TABLE "cots_vendor_assessments"
  ADD COLUMN IF NOT EXISTS "customer_specific_risks_other" varchar(300) DEFAULT NULL;

-- Step 2: Create new table with desired column order
CREATE TABLE "cots_vendor_assessments_new" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "assessment_id" uuid NOT NULL,
  "customer_organization_name" varchar(200),
  "customer_sector" varchar(200),
  "primary_pain_point" text,
  "expected_outcomes" varchar(300),
  "customer_budget_range" varchar(100),
  "implementation_timeline" varchar(100),
  "product_features" jsonb,
  "implementation_approach" varchar(100),
  "customization_level" varchar(100),
  "integration_complexity" varchar(100),
  "regulatory_requirements" jsonb,
  "regulatory_requirements_other" varchar(300) DEFAULT NULL,
  "data_sensitivity" varchar(100),
  "customer_risk_tolerance" varchar(100),
  "alternatives_considered" text,
  "key_advantages" text,
  "customer_specific_risks" jsonb,
  "customer_specific_risks_other" varchar(300) DEFAULT NULL,
  "identified_risks" text,
  "risk_domain_scores" text,
  "contextual_multipliers" text,
  "risk_mitigation" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

INSERT INTO "cots_vendor_assessments_new" (
  id, assessment_id, customer_organization_name, customer_sector, primary_pain_point,
  expected_outcomes, customer_budget_range, implementation_timeline, product_features,
  implementation_approach, customization_level, integration_complexity,
  regulatory_requirements, regulatory_requirements_other, data_sensitivity,
  customer_risk_tolerance, alternatives_considered, key_advantages,
  customer_specific_risks, customer_specific_risks_other, identified_risks,
  risk_domain_scores, contextual_multipliers, risk_mitigation, created_at, updated_at
)
SELECT
  id, assessment_id, customer_organization_name, customer_sector, primary_pain_point,
  expected_outcomes, customer_budget_range, implementation_timeline, product_features,
  implementation_approach, customization_level, integration_complexity,
  regulatory_requirements, regulatory_requirements_other, data_sensitivity,
  customer_risk_tolerance, alternatives_considered, key_advantages,
  customer_specific_risks, customer_specific_risks_other, identified_risks,
  risk_domain_scores, contextual_multipliers, risk_mitigation, created_at, updated_at
FROM "cots_vendor_assessments";

DROP TABLE "cots_vendor_assessments";
ALTER TABLE "cots_vendor_assessments_new" RENAME TO "cots_vendor_assessments";

-- Restore FK: cots_vendor_assessments.assessment_id -> assessments.id
ALTER TABLE "cots_vendor_assessments"
  ADD CONSTRAINT "cots_vendor_assessments_assessment_id_fkey"
  FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id");

COMMENT ON COLUMN "cots_vendor_assessments"."regulatory_requirements_other" IS 'Other regulatory requirements (free text, max 300 chars).';
COMMENT ON COLUMN "cots_vendor_assessments"."customer_specific_risks_other" IS 'Other customer-specific risks (free text, max 300 chars).';
