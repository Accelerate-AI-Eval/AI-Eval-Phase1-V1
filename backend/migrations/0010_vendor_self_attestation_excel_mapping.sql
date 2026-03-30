-- Align vendor_self_attestations with Excel "vendor_self_attestation" sheet column names.
-- Keeps id, user_id, assessment_id, document_uploads, status. API/UI response shape unchanged via backend mapping.

-- Add new columns from Excel (nullable for existing rows)
ALTER TABLE "vendor_self_attestations"
  ADD COLUMN IF NOT EXISTS "organization_id" varchar(255),
  ADD COLUMN IF NOT EXISTS "vendor_type" varchar(100),
  ADD COLUMN IF NOT EXISTS "target_industries" jsonb,
  ADD COLUMN IF NOT EXISTS "company_stage" varchar(100),
  ADD COLUMN IF NOT EXISTS "company_website" varchar(500),
  ADD COLUMN IF NOT EXISTS "company_description" text,
  ADD COLUMN IF NOT EXISTS "no_of_employees" varchar(100),
  ADD COLUMN IF NOT EXISTS "year_founded" integer,
  ADD COLUMN IF NOT EXISTS "headquarter_location" varchar(255),
  ADD COLUMN IF NOT EXISTS "operate_regions" jsonb,
  ADD COLUMN IF NOT EXISTS "market_product_material" text,
  ADD COLUMN IF NOT EXISTS "tech_product_specifications" text,
  ADD COLUMN IF NOT EXISTS "regulatorycompliance_cert_material" text,
  ADD COLUMN IF NOT EXISTS "test_policy_document" varchar(100);

-- Rename columns to match Excel vendor_self_attestation sheet
ALTER TABLE "vendor_self_attestations" RENAME COLUMN "purchase_decision_makers" TO "purchase_decisions_by";
ALTER TABLE "vendor_self_attestations" RENAME COLUMN "pain_points_solved" TO "pain_points";
ALTER TABLE "vendor_self_attestations" RENAME COLUMN "alternatives_considered" TO "alternatives_consider";
ALTER TABLE "vendor_self_attestations" RENAME COLUMN "unique_value_proposition" TO "unique_solution";
ALTER TABLE "vendor_self_attestations" RENAME COLUMN "typical_customer_roi" TO "roi_value_metrics";
ALTER TABLE "vendor_self_attestations" RENAME COLUMN "ai_capabilities" TO "product_capabilities";
ALTER TABLE "vendor_self_attestations" RENAME COLUMN "ai_model_types" TO "ai_models_usage";
ALTER TABLE "vendor_self_attestations" RENAME COLUMN "model_transparency" TO "ai_model_transparency";
ALTER TABLE "vendor_self_attestations" RENAME COLUMN "decision_autonomy" TO "ai_autonomy_level";
ALTER TABLE "vendor_self_attestations" RENAME COLUMN "security_certifications" TO "security_compliance_certificates";
ALTER TABLE "vendor_self_attestations" RENAME COLUMN "assessment_completion_level" TO "assessment_feedback";
ALTER TABLE "vendor_self_attestations" RENAME COLUMN "pii_handling" TO "pii_information";
ALTER TABLE "vendor_self_attestations" RENAME COLUMN "bias_testing_approach" TO "bias_ai";
ALTER TABLE "vendor_self_attestations" RENAME COLUMN "adversarial_security_testing" TO "security_testing";
ALTER TABLE "vendor_self_attestations" RENAME COLUMN "training_data_documentation" TO "training_data_document";
ALTER TABLE "vendor_self_attestations" RENAME COLUMN "uptime_sla" TO "sla_guarantee";
ALTER TABLE "vendor_self_attestations" RENAME COLUMN "rollback_capability" TO "rollback_deployment_issues";
ALTER TABLE "vendor_self_attestations" RENAME COLUMN "hosting_deployment" TO "solution_hosted";
ALTER TABLE "vendor_self_attestations" RENAME COLUMN "product_stage" TO "stage_product";
ALTER TABLE "vendor_self_attestations" RENAME COLUMN "interaction_data_available" TO "available_usage_data";
ALTER TABLE "vendor_self_attestations" RENAME COLUMN "audit_logs_available" TO "audit_logs";
ALTER TABLE "vendor_self_attestations" RENAME COLUMN "testing_results_available" TO "test_results";
