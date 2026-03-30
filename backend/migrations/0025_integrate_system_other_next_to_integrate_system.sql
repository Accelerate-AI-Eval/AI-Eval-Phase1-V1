-- Place integrate_system_other column next to integrate_system by recreating the table.
-- Ensures column exists (adds if 0024 not run) then recreates with correct column order.

-- Step 1: Add column if not present (idempotent; no-op if 0024 already ran)
ALTER TABLE "cots_buyer_assessments"
  ADD COLUMN IF NOT EXISTS "integrate_system_other" varchar(300) DEFAULT NULL;

-- Step 2: Recreate table with integrate_system_other right after integrate_system
CREATE TABLE "cots_buyer_assessments_new" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "buyer_cots_id" uuid UNIQUE DEFAULT gen_random_uuid(),
  "user_id" integer,
  "organization_id" varchar(255),
  "organization_name" varchar(255),
  "industry" varchar(200),
  "industry_sector" varchar(200),
  "employee_count" varchar(100),
  "geographic_regions" jsonb,
  "pain_point" text,
  "business_outcomes" varchar(300),
  "business_unit" varchar(100),
  "budget_range" varchar(100),
  "target_timeline" varchar(100),
  "critical_of_ai_solution" varchar(100),
  "vendor_name" varchar(200),
  "specific_product" varchar(200),
  "gap_requirement_product" text,
  "integrate_system" jsonb,
  "integrate_system_other" varchar(300) DEFAULT NULL,
  "current_tech_stack" jsonb,
  "digital_maturity" varchar(100),
  "governance_maturity" varchar(100),
  "ai_governance_board" varchar(100),
  "ai_ethics_policy" varchar(100),
  "team_composition" jsonb,
  "data_sensitivity_level" varchar(100),
  "regulatory_requirments" jsonb,
  "risk_appetite" varchar(100),
  "statke_at_ai_decisions" varchar(100),
  "impact_by_ai" jsonb,
  "vendor_capabilities" varchar(100),
  "vendor_security_posture" varchar(100),
  "vendor_compliance_certifications" jsonb,
  "phased_rollout_plan" varchar(100),
  "rollback_capability" varchar(100),
  "management_plan" varchar(100),
  "compliance_document" text,
  "vendor_usage_data" varchar(100),
  "audit_logs" varchar(100),
  "testing_results" varchar(100),
  "identified_risks" text,
  "risk_domain_scores" text,
  "contextual_multipliers" text,
  "buyer_risk_mitigation" text,
  "assessment_id" uuid NOT NULL,
  "risk_mitigation_mapping_ids" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

INSERT INTO "cots_buyer_assessments_new" (
  id, buyer_cots_id, user_id, organization_id, organization_name, industry, industry_sector, employee_count, geographic_regions, pain_point, business_outcomes, business_unit, budget_range, target_timeline, critical_of_ai_solution, vendor_name, specific_product, gap_requirement_product, integrate_system, integrate_system_other, current_tech_stack, digital_maturity, governance_maturity, ai_governance_board, ai_ethics_policy, team_composition, data_sensitivity_level, regulatory_requirments, risk_appetite, statke_at_ai_decisions, impact_by_ai, vendor_capabilities, vendor_security_posture, vendor_compliance_certifications, phased_rollout_plan, rollback_capability, management_plan, compliance_document, vendor_usage_data, audit_logs, testing_results, identified_risks, risk_domain_scores, contextual_multipliers, buyer_risk_mitigation, assessment_id, risk_mitigation_mapping_ids, created_at, updated_at
)
SELECT
  id, buyer_cots_id, user_id, organization_id, organization_name, industry, industry_sector, employee_count, geographic_regions, pain_point, business_outcomes, business_unit, budget_range, target_timeline, critical_of_ai_solution, vendor_name, specific_product, gap_requirement_product, integrate_system, integrate_system_other, current_tech_stack, digital_maturity, governance_maturity, ai_governance_board, ai_ethics_policy, team_composition, data_sensitivity_level, regulatory_requirments, risk_appetite, statke_at_ai_decisions, impact_by_ai, vendor_capabilities, vendor_security_posture, vendor_compliance_certifications, phased_rollout_plan, rollback_capability, management_plan, compliance_document, vendor_usage_data, audit_logs, testing_results, identified_risks, risk_domain_scores, contextual_multipliers, buyer_risk_mitigation, assessment_id, risk_mitigation_mapping_ids, created_at, updated_at
FROM "cots_buyer_assessments";

DROP TABLE "cots_buyer_assessments";
ALTER TABLE "cots_buyer_assessments_new" RENAME TO "cots_buyer_assessments";

-- Restore FK: cots_buyer_assessments.assessment_id -> assessments.id
ALTER TABLE "cots_buyer_assessments"
  ADD CONSTRAINT "cots_buyer_assessments_assessment_id_fkey"
  FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id");

COMMENT ON COLUMN "cots_buyer_assessments"."integrate_system_other" IS 'Other integration systems (free text, max 300 chars) when integrate_system includes "Other (Specify Below)".';
