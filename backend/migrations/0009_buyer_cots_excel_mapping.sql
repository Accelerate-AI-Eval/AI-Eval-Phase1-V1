-- Align cots_buyer_assessments with Excel "buyer_cots" sheet column names.
-- Keeps assessment_id for FK; API/UI continue to use camelCase via backend mapping.

-- Add new columns from Excel (nullable for existing rows)
ALTER TABLE "cots_buyer_assessments"
  ADD COLUMN IF NOT EXISTS "user_id" integer,
  ADD COLUMN IF NOT EXISTS "organization_id" varchar(255),
  ADD COLUMN IF NOT EXISTS "organization_name" varchar(255),
  ADD COLUMN IF NOT EXISTS "industry" varchar(200),
  ADD COLUMN IF NOT EXISTS "industry_sector" varchar(200),
  ADD COLUMN IF NOT EXISTS "employee_count" varchar(100),
  ADD COLUMN IF NOT EXISTS "geographic_regions" jsonb,
  ADD COLUMN IF NOT EXISTS "compliance_document" text;

-- Rename columns to match Excel buyer_cots sheet
ALTER TABLE "cots_buyer_assessments" RENAME COLUMN "business_pain_point" TO "pain_point";
ALTER TABLE "cots_buyer_assessments" RENAME COLUMN "expected_outcomes" TO "business_outcomes";
ALTER TABLE "cots_buyer_assessments" RENAME COLUMN "owning_department" TO "business_unit";
ALTER TABLE "cots_buyer_assessments" RENAME COLUMN "criticality" TO "critical_of_ai_solution";
ALTER TABLE "cots_buyer_assessments" RENAME COLUMN "product_name" TO "specific_product";
ALTER TABLE "cots_buyer_assessments" RENAME COLUMN "requirement_gaps" TO "gap_requirement_product";
ALTER TABLE "cots_buyer_assessments" RENAME COLUMN "integration_systems" TO "integrate_system";
ALTER TABLE "cots_buyer_assessments" RENAME COLUMN "tech_stack" TO "current_tech_stack";
ALTER TABLE "cots_buyer_assessments" RENAME COLUMN "digital_maturity_level" TO "digital_maturity";
ALTER TABLE "cots_buyer_assessments" RENAME COLUMN "data_governance_maturity" TO "governance_maturity";
ALTER TABLE "cots_buyer_assessments" RENAME COLUMN "implementation_team_composition" TO "team_composition";
ALTER TABLE "cots_buyer_assessments" RENAME COLUMN "data_sensitivity" TO "data_sensitivity_level";
ALTER TABLE "cots_buyer_assessments" RENAME COLUMN "regulatory_requirements" TO "regulatory_requirments";
ALTER TABLE "cots_buyer_assessments" RENAME COLUMN "decision_stakes" TO "statke_at_ai_decisions";
ALTER TABLE "cots_buyer_assessments" RENAME COLUMN "impacted_stakeholders" TO "impact_by_ai";
ALTER TABLE "cots_buyer_assessments" RENAME COLUMN "vendor_validation_approach" TO "vendor_capabilities";
ALTER TABLE "cots_buyer_assessments" RENAME COLUMN "vendor_certifications" TO "vendor_compliance_certifications";
ALTER TABLE "cots_buyer_assessments" RENAME COLUMN "pilot_rollout_plan" TO "phased_rollout_plan";
ALTER TABLE "cots_buyer_assessments" RENAME COLUMN "change_management_plan" TO "management_plan";
ALTER TABLE "cots_buyer_assessments" RENAME COLUMN "monitoring_data_available" TO "vendor_usage_data";
ALTER TABLE "cots_buyer_assessments" RENAME COLUMN "audit_logs_available" TO "audit_logs";
ALTER TABLE "cots_buyer_assessments" RENAME COLUMN "testing_results_available" TO "testing_results";
ALTER TABLE "cots_buyer_assessments" RENAME COLUMN "risk_mitigation" TO "buyer_risk_mitigation";
