-- Drop risk_mappings and recreate with new schema matching Excel headers:
-- Risk Category, Sub-Risk Category, Risk Description, Risk Level,
-- Risk Impact (Financial), Risk Impact (Operational), Risk Impact (Reputational),
-- Control ID, Control Description, Control Effectiveness, Residual Risk Level,
-- Mitigation Strategy, Owner, Review Date, Status

DROP TABLE IF EXISTS public.risk_mappings CASCADE;

CREATE TABLE public.risk_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  risk_category varchar(300),
  sub_risk_category varchar(300),
  risk_description text,
  risk_level varchar(100),
  risk_impact_financial text,
  risk_impact_operational text,
  risk_impact_reputational text,
  control_id varchar(200),
  control_description text,
  control_effectiveness varchar(200),
  residual_risk_level varchar(100),
  mitigation_strategy text,
  owner varchar(300),
  review_date varchar(100),
  status varchar(100),
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.risk_mappings IS 'Risk mappings from Excel: Risk Category, Sub-Risk Category, Risk Description, Risk Level, impacts, Control ID/Description/Effectiveness, Residual Risk Level, Mitigation Strategy, Owner, Review Date, Status.';

CREATE INDEX IF NOT EXISTS idx_risk_mappings_risk_category ON public.risk_mappings (risk_category);
CREATE INDEX IF NOT EXISTS idx_risk_mappings_control_id ON public.risk_mappings (control_id) WHERE control_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_risk_mappings_status ON public.risk_mappings (status) WHERE status IS NOT NULL;
