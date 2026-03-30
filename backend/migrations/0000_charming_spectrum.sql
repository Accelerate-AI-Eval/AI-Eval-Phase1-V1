-- Create enums only if they don't exist (safe for re-run)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_status') THEN
    CREATE TYPE "public"."account_status" AS ENUM('invited', 'confirmed');
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assessment_status') THEN
    CREATE TYPE "public"."assessment_status" AS ENUM('draft', 'submitted');
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_onboarding_completed') THEN
    CREATE TYPE "public"."user_onboarding_completed" AS ENUM('true', 'false');
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'organizationStatus') THEN
    CREATE TYPE "public"."organizationStatus" AS ENUM('active', 'inactive');
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'organization_type') THEN
    CREATE TYPE "public"."organization_type" AS ENUM('buyer', 'vendor');
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_signup_completed') THEN
    CREATE TYPE "public"."user_signup_completed" AS ENUM('true', 'false');
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assessment_type') THEN
    CREATE TYPE "public"."assessment_type" AS ENUM('custom_ai', 'cots_buyer', 'cots_vendor', 'vendor_self_attestation');
  END IF;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assessment_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"document_type" varchar(50) NOT NULL,
	"file_path" varchar(500) NOT NULL,
	"file_name" varchar(255),
	"mime_type" varchar(100),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assessment_risks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"risk_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "assessment_type" NOT NULL,
	"organization_id" uuid NOT NULL,
	"status" "assessment_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "buyer_onboarding" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"organization_name" varchar(200) NOT NULL,
	"organization_type" varchar(100),
	"sector" varchar(500),
	"organization_website" varchar(500),
	"organization_description" varchar(500),
	"primary_contact_name" varchar(100) NOT NULL,
	"primary_contact_email" varchar(255) NOT NULL,
	"primary_contact_role" varchar(100),
	"department_owner" varchar(100),
	"employee_count" varchar(50),
	"annual_revenue" varchar(50),
	"year_founded" integer,
	"headquarters_location" varchar(100),
	"operating_regions" jsonb,
	"data_residency_requirements" jsonb,
	"existing_ai_initiatives" varchar(100),
	"ai_governance_maturity" varchar(100),
	"data_governance_maturity" varchar(100),
	"ai_skills_availability" varchar(100),
	"change_management_capability" varchar(100),
	"primary_regulatory_frameworks" jsonb,
	"regulatory_penalty_exposure" varchar(50),
	"data_classification_handled" jsonb,
	"pii_handling" varchar(100),
	"existing_tech_stack" jsonb,
	"ai_risk_appetite" varchar(100),
	"acceptable_risk_level" varchar(50),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cots_buyer_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"business_pain_point" text,
	"expected_outcomes" varchar(300),
	"owning_department" varchar(100),
	"budget_range" varchar(100),
	"target_timeline" varchar(100),
	"criticality" varchar(100),
	"vendor_name" varchar(200),
	"product_name" varchar(200),
	"requirement_gaps" text,
	"integration_systems" jsonb,
	"tech_stack" jsonb,
	"digital_maturity_level" varchar(100),
	"data_governance_maturity" varchar(100),
	"ai_governance_board" varchar(100),
	"ai_ethics_policy" varchar(100),
	"implementation_team_composition" jsonb,
	"data_sensitivity" varchar(100),
	"regulatory_requirements" jsonb,
	"risk_appetite" varchar(100),
	"decision_stakes" varchar(100),
	"impacted_stakeholders" jsonb,
	"vendor_validation_approach" varchar(100),
	"vendor_security_posture" varchar(100),
	"vendor_certifications" jsonb,
	"pilot_rollout_plan" varchar(100),
	"rollback_capability" varchar(100),
	"change_management_plan" varchar(100),
	"monitoring_data_available" varchar(100),
	"audit_logs_available" varchar(100),
	"testing_results_available" varchar(100),
	"identified_risks" text,
	"risk_domain_scores" text,
	"contextual_multipliers" text,
	"risk_mitigation" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cots_vendor_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
	"data_sensitivity" varchar(100),
	"customer_risk_tolerance" varchar(100),
	"alternatives_considered" text,
	"key_advantages" text,
	"customer_specific_risks" jsonb,
	"identified_risks" text,
	"risk_domain_scores" text,
	"contextual_multipliers" text,
	"risk_mitigation" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organizations" (
	"id" serial PRIMARY KEY NOT NULL,
	"organizationName" varchar NOT NULL,
	"organizationStatus" "organizationStatus" DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "custom_ai_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"business_pain_point" text,
	"expected_outcomes" varchar(300),
	"owning_department" varchar(100),
	"target_timeline" varchar(100),
	"criticality" varchar(100),
	"build_rationale" text,
	"development_platform" jsonb,
	"ml_frameworks" jsonb,
	"ai_model_types" jsonb,
	"customization_level" varchar(100),
	"development_stage" varchar(100),
	"training_data_source" jsonb,
	"training_data_volume" varchar(100),
	"training_data_quality" varchar(100),
	"training_data_biases" varchar(100),
	"data_labeling_process" varchar(100),
	"bias_testing_plan" jsonb,
	"adversarial_testing" varchar(100),
	"interpretability_approach" varchar(100),
	"human_oversight" jsonb,
	"decision_autonomy" varchar(100),
	"continuous_learning" varchar(100),
	"ai_governance_board" varchar(100),
	"ai_ethics_policy" varchar(100),
	"executive_sponsorship" varchar(100),
	"team_composition" jsonb,
	"development_budget" varchar(100),
	"hosting_type" varchar(100),
	"deployment_options" jsonb,
	"data_residency" jsonb,
	"model_version_control" varchar(100),
	"rollback_procedures" varchar(100),
	"data_sensitivity" varchar(100),
	"regulatory_requirements" jsonb,
	"risk_appetite" varchar(100),
	"decision_stakes" varchar(100),
	"validation_approach" varchar(100),
	"identified_risks" text,
	"risk_domain_scores" text,
	"contextual_multipliers" text,
	"risk_mitigation" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "risk_top5_mitigations" (
	"mapping_id" integer NOT NULL,
	"risk_id" varchar(50) NOT NULL,
	"mitigation_action_id" varchar(100) NOT NULL,
	"mitigation_action_name" varchar(500) NOT NULL,
	"mitigation_category" varchar(200) NOT NULL,
	"mitigation_definition" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "risks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"risk_id" varchar(50) NOT NULL,
	"title" varchar(500) NOT NULL,
	"domain" varchar(100),
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"organization_name" varchar NOT NULL,
	"role" varchar(255) NOT NULL,
	"invited_at" timestamp DEFAULT now() NOT NULL,
	"invited_by" varchar NOT NULL,
	"account_status" "account_status" DEFAULT 'invited' NOT NULL,
	"user_name" varchar,
	"user_first_name" varchar,
	"user_last_name" varchar,
	"user_password" text,
	"userStatus" "organizationStatus" DEFAULT 'active' NOT NULL,
	"user_signup_completed" "user_signup_completed" DEFAULT 'false' NOT NULL,
	"user_onboarding_completed" "user_onboarding_completed" DEFAULT 'false' NOT NULL,
	"user_platform_role" varchar,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_user_name_unique" UNIQUE("user_name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vendor_onboarding" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"vendor_type" varchar(100) NOT NULL,
	"sector" varchar(500),
	"vendor_maturity" varchar(100),
	"company_website" varchar(500) NOT NULL,
	"company_description" varchar(500) NOT NULL,
	"primary_contact_name" varchar(100) NOT NULL,
	"primary_contact_email" varchar(255) NOT NULL,
	"primary_contact_role" varchar(100),
	"employee_count" varchar(50) NOT NULL,
	"year_founded" integer NOT NULL,
	"headquarters_location" varchar(100) NOT NULL,
	"operating_regions" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vendor_self_attestations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"purchase_decision_makers" jsonb,
	"pain_points_solved" text,
	"alternatives_considered" text,
	"unique_value_proposition" text,
	"typical_customer_roi" varchar(500),
	"ai_capabilities" jsonb,
	"ai_model_types" jsonb,
	"model_transparency" varchar(100),
	"decision_autonomy" varchar(100),
	"security_certifications" jsonb,
	"assessment_completion_level" varchar(100),
	"pii_handling" varchar(100),
	"data_residency_options" jsonb,
	"data_retention_policy" text,
	"bias_testing_approach" jsonb,
	"adversarial_security_testing" varchar(100),
	"human_oversight" jsonb,
	"training_data_documentation" varchar(100),
	"uptime_sla" varchar(100),
	"incident_response_plan" varchar(100),
	"rollback_capability" varchar(100),
	"hosting_deployment" jsonb,
	"deployment_scale" varchar(100),
	"product_stage" varchar(100),
	"interaction_data_available" varchar(100),
	"audit_logs_available" varchar(100),
	"testing_results_available" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
