-- Drop risk_mappings and recreate to match Excel headers:
-- Risk_id, Risk_Title, Domains, Description, Technical_Description, Executive_Summary,
-- Attack_Vector, Observable_Indicators, Data_to_Identify_Risk, Evidence_Sources,
-- Intent, Timing, Risk_Type_Detected, Primary_Risk, Secondary_Risks

DROP TABLE IF EXISTS public.risk_mappings CASCADE;

CREATE TABLE public.risk_mappings (
  risk_mapping_id serial PRIMARY KEY,
  risk_id varchar(255),
  risk_title varchar(255),
  domains varchar(255),
  description text,
  technical_description text,
  executive_summary text,
  attack_vector varchar(255),
  observable_indicators text,
  data_to_identify_risk text,
  evidence_sources text,
  intent varchar(255),
  timing varchar(255),
  risk_type_detected varchar(255),
  primary_risk varchar(255),
  secondary_risks varchar(255)
);

COMMENT ON TABLE public.risk_mappings IS 'Risk mappings from Excel: risk_id, risk_title, domains, description, technical_description, executive_summary, attack_vector, observable_indicators, data_to_identify_risk, evidence_sources, intent, timing, risk_type_detected, primary_risk, secondary_risks.';

CREATE INDEX IF NOT EXISTS idx_risk_mappings_domains ON public.risk_mappings (domains) WHERE domains IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_risk_mappings_risk_type_detected ON public.risk_mappings (risk_type_detected) WHERE risk_type_detected IS NOT NULL;
