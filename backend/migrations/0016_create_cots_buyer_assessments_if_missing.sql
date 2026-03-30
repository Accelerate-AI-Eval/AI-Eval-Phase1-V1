-- Create cots_buyer_assessments table if missing (Excel "buyer_cots" structure).
-- Safe to run: CREATE TABLE IF NOT EXISTS.
-- Requires: assessments table must exist (assessment_id FK).

CREATE TABLE IF NOT EXISTS "cots_buyer_assessments" (
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

-- Add FK to assessments (requires assessments table to exist)
ALTER TABLE "cots_buyer_assessments"
  DROP CONSTRAINT IF EXISTS "cots_buyer_assessments_assessment_id_fkey";
ALTER TABLE "cots_buyer_assessments"
  ADD CONSTRAINT "cots_buyer_assessments_assessment_id_fkey"
  FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id");
