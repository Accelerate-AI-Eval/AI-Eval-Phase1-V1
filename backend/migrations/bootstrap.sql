-- =============================================================================
-- BOOTSTRAP: Full schema for AI Eval DB (all tables in public, correct columns).
-- Safe to run on empty DB. On existing DB, creates only missing objects (IF NOT EXISTS).
-- Run: node migrations/run-bootstrap.js
-- =============================================================================

-- 1. Enums (public)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_status') THEN
    CREATE TYPE public.account_status AS ENUM('invited', 'confirmed');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assessment_status') THEN
    CREATE TYPE public.assessment_status AS ENUM('draft', 'submitted');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_onboarding_completed') THEN
    CREATE TYPE public.user_onboarding_completed AS ENUM('true', 'false');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'organizationStatus') THEN
    CREATE TYPE "public"."organizationStatus" AS ENUM('active', 'inactive');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'organization_type') THEN
    CREATE TYPE public.organization_type AS ENUM('buyer', 'vendor');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_signup_completed') THEN
    CREATE TYPE public.user_signup_completed AS ENUM('true', 'false');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assessment_type') THEN
    CREATE TYPE public.assessment_type AS ENUM('custom_ai', 'cots_buyer', 'cots_vendor', 'vendor_self_attestation');
  END IF;
END $$;

-- 2. Core tables (order: no FKs first, then dependents)
CREATE TABLE IF NOT EXISTS public.organizations (
  id serial PRIMARY KEY NOT NULL,
  "organizationName" varchar NOT NULL,
  "organizationStatus" "public"."organizationStatus" DEFAULT 'active' NOT NULL,
  created_at timestamp DEFAULT now() NOT NULL,
  created_by varchar NOT NULL
);

-- Seed AI EVAL organization at id 1 (for dropdown and user management)
INSERT INTO public.organizations (id, "organizationName", "organizationStatus", created_at, created_by)
VALUES (1, 'ai eval', 'active', now(), 'system')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.users (
  id serial PRIMARY KEY NOT NULL,
  email varchar(255) NOT NULL,
  organization_id integer NOT NULL REFERENCES public.organizations(id),
  role varchar(255) NOT NULL,
  invited_at timestamp DEFAULT now() NOT NULL,
  invited_by varchar NOT NULL,
  account_status public.account_status DEFAULT 'invited' NOT NULL,
  user_name varchar,
  user_first_name varchar,
  user_last_name varchar,
  user_password text,
  "userStatus" "public"."organizationStatus" DEFAULT 'active' NOT NULL,
  user_signup_completed public.user_signup_completed DEFAULT 'false' NOT NULL,
  user_onboarding_completed public.user_onboarding_completed DEFAULT 'false' NOT NULL,
  user_platform_role varchar,
  CONSTRAINT users_email_unique UNIQUE(email),
  CONSTRAINT users_user_name_unique UNIQUE(user_name)
);

CREATE TABLE IF NOT EXISTS public.assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  type public.assessment_type NOT NULL,
  organization_id varchar(255) NOT NULL,
  status public.assessment_status DEFAULT 'draft' NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.assessment_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  assessment_id uuid NOT NULL,
  document_type varchar(50) NOT NULL,
  file_path varchar(500) NOT NULL,
  file_name varchar(255),
  mime_type varchar(100),
  notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.assessment_risks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  assessment_id uuid NOT NULL,
  risk_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.buyer_onboarding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  user_id integer,
  organization_id varchar(255) NOT NULL,
  organization_name varchar(200) NOT NULL,
  organization_type varchar(100),
  sector varchar(500),
  organization_website varchar(500),
  organization_description varchar(500),
  primary_contact_name varchar(100) NOT NULL,
  primary_contact_email varchar(255) NOT NULL,
  primary_contact_role varchar(100),
  department_owner varchar(100),
  employee_count varchar(50),
  annual_revenue varchar(50),
  year_founded integer,
  headquarters_location varchar(100),
  operating_regions jsonb,
  data_residency_requirements jsonb,
  existing_ai_initiatives varchar(100),
  ai_governance_maturity varchar(100),
  data_governance_maturity varchar(100),
  ai_skills_availability varchar(100),
  change_management_capability varchar(100),
  primary_regulatory_frameworks jsonb,
  regulatory_penalty_exposure varchar(50),
  data_classification_handled jsonb,
  pii_handling varchar(100),
  existing_tech_stack jsonb,
  ai_risk_appetite varchar(100),
  acceptable_risk_level varchar(50),
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.vendor_onboarding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  user_id integer,
  organization_id varchar(255) NOT NULL,
  vendor_type varchar(100) NOT NULL,
  sector varchar(500),
  vendor_maturity varchar(100),
  company_website varchar(500) NOT NULL,
  company_description varchar(500) NOT NULL,
  primary_contact_name varchar(100) NOT NULL,
  primary_contact_email varchar(255) NOT NULL,
  primary_contact_role varchar(100),
  employee_count varchar(50) NOT NULL,
  year_founded integer NOT NULL,
  headquarters_location varchar(100) NOT NULL,
  operating_regions jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- cots_buyer_assessments (Excel buyer_cots columns)
CREATE TABLE IF NOT EXISTS public.cots_buyer_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  buyer_cots_id uuid UNIQUE DEFAULT gen_random_uuid(),
  user_id integer,
  organization_id varchar(255),
  organization_name varchar(255),
  industry varchar(200),
  industry_sector varchar(200),
  employee_count varchar(100),
  geographic_regions jsonb,
  pain_point text,
  business_outcomes varchar(300),
  business_unit varchar(100),
  budget_range varchar(100),
  target_timeline varchar(100),
  critical_of_ai_solution varchar(100),
  vendor_name varchar(200),
  specific_product varchar(200),
  gap_requirement_product text,
  integrate_system jsonb,
  current_tech_stack jsonb,
  digital_maturity varchar(100),
  governance_maturity varchar(100),
  ai_governance_board varchar(100),
  ai_ethics_policy varchar(100),
  team_composition jsonb,
  data_sensitivity_level varchar(100),
  regulatory_requirments jsonb,
  risk_appetite varchar(100),
  statke_at_ai_decisions varchar(100),
  impact_by_ai jsonb,
  vendor_capabilities varchar(100),
  vendor_security_posture varchar(100),
  vendor_compliance_certifications jsonb,
  phased_rollout_plan varchar(100),
  rollback_capability varchar(100),
  management_plan varchar(100),
  compliance_document text,
  vendor_usage_data varchar(100),
  audit_logs varchar(100),
  testing_results varchar(100),
  identified_risks text,
  risk_domain_scores text,
  contextual_multipliers text,
  buyer_risk_mitigation text,
  assessment_id uuid NOT NULL REFERENCES public.assessments(id),
  risk_mitigation_mapping_ids jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.cots_vendor_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  assessment_id uuid NOT NULL REFERENCES public.assessments(id),
  customer_organization_name varchar(200),
  customer_sector varchar(200),
  primary_pain_point text,
  expected_outcomes varchar(300),
  customer_budget_range varchar(100),
  implementation_timeline varchar(100),
  product_features jsonb,
  implementation_approach varchar(100),
  customization_level varchar(100),
  integration_complexity varchar(100),
  regulatory_requirements jsonb,
  data_sensitivity varchar(100),
  customer_risk_tolerance varchar(100),
  alternatives_considered text,
  key_advantages text,
  customer_specific_risks jsonb,
  identified_risks text,
  risk_domain_scores text,
  contextual_multipliers text,
  risk_mitigation text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.custom_ai_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  assessment_id uuid NOT NULL REFERENCES public.assessments(id),
  business_pain_point text,
  expected_outcomes varchar(300),
  owning_department varchar(100),
  target_timeline varchar(100),
  criticality varchar(100),
  build_rationale text,
  development_platform jsonb,
  ml_frameworks jsonb,
  ai_model_types jsonb,
  customization_level varchar(100),
  development_stage varchar(100),
  training_data_source jsonb,
  training_data_volume varchar(100),
  training_data_quality varchar(100),
  training_data_biases varchar(100),
  data_labeling_process varchar(100),
  bias_testing_plan jsonb,
  adversarial_testing varchar(100),
  interpretability_approach varchar(100),
  human_oversight jsonb,
  decision_autonomy varchar(100),
  continuous_learning varchar(100),
  ai_governance_board varchar(100),
  ai_ethics_policy varchar(100),
  executive_sponsorship varchar(100),
  team_composition jsonb,
  development_budget varchar(100),
  hosting_type varchar(100),
  deployment_options jsonb,
  data_residency jsonb,
  model_version_control varchar(100),
  rollback_procedures varchar(100),
  data_sensitivity varchar(100),
  regulatory_requirements jsonb,
  risk_appetite varchar(100),
  decision_stakes varchar(100),
  validation_approach varchar(100),
  identified_risks text,
  risk_domain_scores text,
  contextual_multipliers text,
  risk_mitigation text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- vendor_self_attestations (Excel columns)
CREATE TABLE IF NOT EXISTS public.vendor_self_attestations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  vendor_self_attestation_id uuid UNIQUE DEFAULT gen_random_uuid(),
  user_id integer,
  organization_id varchar(255),
  vendor_type varchar(100),
  target_industries jsonb,
  company_stage varchar(100),
  company_website varchar(500),
  company_description text,
  no_of_employees varchar(100),
  year_founded integer,
  headquarter_location varchar(255),
  operate_regions jsonb,
  market_product_material text,
  tech_product_specifications text,
  regulatorycompliance_cert_material text,
  purchase_decisions_by jsonb,
  pain_points text,
  alternatives_consider text,
  unique_solution text,
  roi_value_metrics varchar(500),
  product_capabilities jsonb,
  ai_models_usage jsonb,
  ai_model_transparency varchar(100),
  ai_autonomy_level varchar(100),
  security_compliance_certificates jsonb,
  assessment_feedback varchar(100),
  pii_information varchar(100),
  data_residency_options jsonb,
  data_retention_policy text,
  bias_ai jsonb,
  security_testing varchar(100),
  human_oversight jsonb,
  training_data_document varchar(100),
  sla_guarantee varchar(100),
  incident_response_plan varchar(100),
  rollback_deployment_issues varchar(100),
  solution_hosted jsonb,
  deployment_scale varchar(100),
  stage_product varchar(100),
  test_policy_document varchar(100),
  available_usage_data varchar(100),
  audit_logs varchar(100),
  test_results varchar(100),
  assessment_id uuid REFERENCES public.assessments(id),
  document_uploads jsonb,
  status varchar(20) DEFAULT 'DRAFT',
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Generated product profile reports (from POST /vendorSelfAttestation/generate-profile)
CREATE TABLE IF NOT EXISTS public.generated_profile_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  organization_id varchar(255),
  attestation_id uuid REFERENCES public.vendor_self_attestations(id) ON DELETE SET NULL,
  trust_score integer NOT NULL,
  summary text,
  report jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_generated_profile_reports_user_id ON public.generated_profile_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_generated_profile_reports_org_id ON public.generated_profile_reports(organization_id);
CREATE INDEX IF NOT EXISTS idx_generated_profile_reports_attestation_id ON public.generated_profile_reports(attestation_id);
CREATE INDEX IF NOT EXISTS idx_generated_profile_reports_created_at ON public.generated_profile_reports(created_at DESC);

CREATE TABLE IF NOT EXISTS public.attestations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  assessment_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.organizationEditLogs (
  id serial PRIMARY KEY NOT NULL,
  "organizationId" varchar NOT NULL,
  "organizationName" varchar NOT NULL,
  "organizationStatus" "public"."organizationStatus" NOT NULL,
  updated_by varchar NOT NULL,
  reason varchar NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.userEditLogs (
  id serial PRIMARY KEY NOT NULL,
  "userId" varchar NOT NULL,
  email varchar(255) NOT NULL,
  "organizationName" varchar NOT NULL,
  "userStatus" "public"."organizationStatus" NOT NULL,
  updated_by varchar NOT NULL,
  reason varchar NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.risks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  risk_id varchar(50) NOT NULL,
  title varchar(500) NOT NULL,
  domain varchar(100),
  description text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.risk_top5_mitigations (
  mapping_id integer NOT NULL,
  risk_id varchar(50) NOT NULL,
  mitigation_action_id varchar(100) NOT NULL,
  mitigation_action_name varchar(500) NOT NULL,
  mitigation_category varchar(200) NOT NULL,
  mitigation_definition text
);

-- 3. Sectors and industries (public) + seed
CREATE TABLE IF NOT EXISTS public.sectors (
  industry_id integer PRIMARY KEY NOT NULL,
  industry_name varchar(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.industries (
  industry_sector_id integer PRIMARY KEY NOT NULL,
  industry_id integer NOT NULL REFERENCES public.sectors(industry_id) ON DELETE CASCADE,
  sector_name varchar(200) NOT NULL
);

INSERT INTO public.sectors (industry_id, industry_name) VALUES
  (1, 'public'),
  (2, 'private'),
  (3, 'non-profit')
ON CONFLICT (industry_id) DO NOTHING;

INSERT INTO public.industries (industry_sector_id, industry_id, sector_name) VALUES
  (1, 1, 'Federal Government (US)'),
  (2, 1, 'State Government (US)'),
  (3, 1, 'Local Government (US)'),
  (4, 1, 'International Governments'),
  (5, 1, 'Educational Institutions (Public)'),
  (6, 1, 'Public Healthcare Systems'),
  (7, 1, 'Public Utilities'),
  (8, 1, 'Defense & Military'),
  (9, 1, 'Law Enforcement & Emergency Services'),
  (10, 2, 'Healthcare'),
  (11, 2, 'Finance & Banking'),
  (12, 2, 'Insurance'),
  (13, 2, 'GovTech'),
  (14, 2, 'Manufacturing'),
  (15, 2, 'Retail & E-commerce'),
  (16, 2, 'Technology & Software'),
  (17, 2, 'Telecommunications'),
  (18, 2, 'Energy & Utilities'),
  (19, 2, 'Transportation & Logistics'),
  (20, 2, 'Real Estate & Construction'),
  (21, 2, 'Professional Services'),
  (22, 2, 'Media & Entertainment'),
  (23, 2, 'Hospitality & Tourism'),
  (24, 2, 'Agriculture & Food Production'),
  (25, 2, 'Pharmaceuticals & Biotechnology'),
  (26, 2, 'Automotive'),
  (27, 2, 'Aerospace & Defense (Private)'),
  (28, 2, 'Chemical & Materials'),
  (29, 2, 'Consumer Goods'),
  (30, 2, 'Unknown'),
  (31, 3, 'Educational Institutions (Non-Profit)'),
  (32, 3, 'Healthcare (Non-Profit)'),
  (33, 3, 'Social Services'),
  (34, 3, 'Arts & Culture'),
  (35, 3, 'Environmental & Conservation'),
  (36, 3, 'International Development & Relief'),
  (37, 3, 'Advocacy & Civil Rights'),
  (38, 3, 'Religious Organizations'),
  (39, 3, 'Research & Think Tanks'),
  (40, 3, 'Foundations & Grantmaking'),
  (41, 3, 'Foundations & Grantmaking'),
  (42, 3, 'Community Development')
ON CONFLICT (industry_sector_id) DO NOTHING;
