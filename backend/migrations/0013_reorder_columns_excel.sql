-- Reorder columns to match DB Schema Mapping Excel sheet order (nested sheets).
-- PostgreSQL requires recreating tables to change column order.
-- Ensure source tables have required columns (idempotent).

ALTER TABLE "vendor_self_attestations" ADD COLUMN IF NOT EXISTS "vendor_self_attestation_id" uuid UNIQUE DEFAULT gen_random_uuid();
ALTER TABLE "vendor_self_attestations" ADD COLUMN IF NOT EXISTS "user_id" integer;
ALTER TABLE "vendor_self_attestations" ADD COLUMN IF NOT EXISTS "organization_id" varchar(255);
ALTER TABLE "vendor_self_attestations" ADD COLUMN IF NOT EXISTS "status" varchar(20) DEFAULT 'DRAFT';
ALTER TABLE "vendor_self_attestations" ADD COLUMN IF NOT EXISTS "document_uploads" jsonb;
UPDATE "vendor_self_attestations" SET "vendor_self_attestation_id" = "id" WHERE "vendor_self_attestation_id" IS NULL;

ALTER TABLE "cots_buyer_assessments" ADD COLUMN IF NOT EXISTS "buyer_cots_id" uuid UNIQUE DEFAULT gen_random_uuid();
UPDATE "cots_buyer_assessments" SET "buyer_cots_id" = "id" WHERE "buyer_cots_id" IS NULL;

-- ========== vendor_self_attestation sheet order ==========
CREATE TABLE "vendor_self_attestations_new" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "vendor_self_attestation_id" uuid UNIQUE DEFAULT gen_random_uuid(),
  "user_id" integer,
  "organization_id" varchar(255),
  "vendor_type" varchar(100),
  "target_industries" jsonb,
  "company_stage" varchar(100),
  "company_website" varchar(500),
  "company_description" text,
  "no_of_employees" varchar(100),
  "year_founded" integer,
  "headquarter_location" varchar(255),
  "operate_regions" jsonb,
  "market_product_material" text,
  "tech_product_specifications" text,
  "regulatorycompliance_cert_material" text,
  "purchase_decisions_by" jsonb,
  "pain_points" text,
  "alternatives_consider" text,
  "unique_solution" text,
  "roi_value_metrics" varchar(500),
  "product_capabilities" jsonb,
  "ai_models_usage" jsonb,
  "ai_model_transparency" varchar(100),
  "ai_autonomy_level" varchar(100),
  "security_compliance_certificates" jsonb,
  "assessment_feedback" varchar(100),
  "pii_information" varchar(100),
  "data_residency_options" jsonb,
  "data_retention_policy" text,
  "bias_ai" jsonb,
  "security_testing" varchar(100),
  "human_oversight" jsonb,
  "training_data_document" varchar(100),
  "sla_guarantee" varchar(100),
  "incident_response_plan" varchar(100),
  "rollback_deployment_issues" varchar(100),
  "solution_hosted" jsonb,
  "deployment_scale" varchar(100),
  "stage_product" varchar(100),
  "test_policy_document" varchar(100),
  "available_usage_data" varchar(100),
  "audit_logs" varchar(100),
  "test_results" varchar(100),
  "assessment_id" uuid,
  "document_uploads" jsonb,
  "status" varchar(20) DEFAULT 'DRAFT',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

INSERT INTO "vendor_self_attestations_new" (
  id, vendor_self_attestation_id, user_id, organization_id, vendor_type, target_industries, company_stage, company_website, company_description, no_of_employees, year_founded, headquarter_location, operate_regions, market_product_material, tech_product_specifications, regulatorycompliance_cert_material, purchase_decisions_by, pain_points, alternatives_consider, unique_solution, roi_value_metrics, product_capabilities, ai_models_usage, ai_model_transparency, ai_autonomy_level, security_compliance_certificates, assessment_feedback, pii_information, data_residency_options, data_retention_policy, bias_ai, security_testing, human_oversight, training_data_document, sla_guarantee, incident_response_plan, rollback_deployment_issues, solution_hosted, deployment_scale, stage_product, test_policy_document, available_usage_data, audit_logs, test_results, assessment_id, document_uploads, status, created_at, updated_at
)
SELECT
  id, vendor_self_attestation_id, user_id, organization_id, vendor_type, target_industries, company_stage, company_website, company_description, no_of_employees, year_founded, headquarter_location, operate_regions, market_product_material, tech_product_specifications, regulatorycompliance_cert_material, purchase_decisions_by, pain_points, alternatives_consider, unique_solution, roi_value_metrics, product_capabilities, ai_models_usage, ai_model_transparency, ai_autonomy_level, security_compliance_certificates, assessment_feedback, pii_information, data_residency_options, data_retention_policy, bias_ai, security_testing, human_oversight, training_data_document, sla_guarantee, incident_response_plan, rollback_deployment_issues, solution_hosted, deployment_scale, stage_product, test_policy_document, available_usage_data, audit_logs, test_results, assessment_id, document_uploads, status, created_at, updated_at
FROM "vendor_self_attestations";

DROP TABLE "vendor_self_attestations";
ALTER TABLE "vendor_self_attestations_new" RENAME TO "vendor_self_attestations";

-- ========== buyer_cots sheet order ==========
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
  id, buyer_cots_id, user_id, organization_id, organization_name, industry, industry_sector, employee_count, geographic_regions, pain_point, business_outcomes, business_unit, budget_range, target_timeline, critical_of_ai_solution, vendor_name, specific_product, gap_requirement_product, integrate_system, current_tech_stack, digital_maturity, governance_maturity, ai_governance_board, ai_ethics_policy, team_composition, data_sensitivity_level, regulatory_requirments, risk_appetite, statke_at_ai_decisions, impact_by_ai, vendor_capabilities, vendor_security_posture, vendor_compliance_certifications, phased_rollout_plan, rollback_capability, management_plan, compliance_document, vendor_usage_data, audit_logs, testing_results, identified_risks, risk_domain_scores, contextual_multipliers, buyer_risk_mitigation, assessment_id, risk_mitigation_mapping_ids, created_at, updated_at
)
SELECT
  id, buyer_cots_id, user_id, organization_id, organization_name, industry, industry_sector, employee_count, geographic_regions, pain_point, business_outcomes, business_unit, budget_range, target_timeline, critical_of_ai_solution, vendor_name, specific_product, gap_requirement_product, integrate_system, current_tech_stack, digital_maturity, governance_maturity, ai_governance_board, ai_ethics_policy, team_composition, data_sensitivity_level, regulatory_requirments, risk_appetite, statke_at_ai_decisions, impact_by_ai, vendor_capabilities, vendor_security_posture, vendor_compliance_certifications, phased_rollout_plan, rollback_capability, management_plan, compliance_document, vendor_usage_data, audit_logs, testing_results, identified_risks, risk_domain_scores, contextual_multipliers, buyer_risk_mitigation, assessment_id, risk_mitigation_mapping_ids, created_at, updated_at
FROM "cots_buyer_assessments";

DROP TABLE "cots_buyer_assessments";
ALTER TABLE "cots_buyer_assessments_new" RENAME TO "cots_buyer_assessments";

-- Restore FK: cots_buyer_assessments.assessment_id -> assessments.id
ALTER TABLE "cots_buyer_assessments"
  ADD CONSTRAINT "cots_buyer_assessments_assessment_id_fkey"
  FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id");
