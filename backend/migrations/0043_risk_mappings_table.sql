-- Table for "Shared Enhanced Risk Database Jan 2026.xlsx" data.
-- Holds both risk rows (risk_id, risk_title, risk_domain, risk_description) and
-- mapping rows (mapping_id, risk_id, mitigation_action_*, mitigation_category, mitigation_definition).

CREATE TABLE IF NOT EXISTS public.risk_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  mapping_id integer,
  risk_id varchar(50) NOT NULL,
  risk_title varchar(500),
  risk_domain varchar(100),
  risk_description text,
  mitigation_action_id varchar(100),
  mitigation_action_name varchar(500),
  mitigation_category varchar(200),
  mitigation_definition text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Ensure columns exist if table was created with a different structure
ALTER TABLE public.risk_mappings ADD COLUMN IF NOT EXISTS mapping_id integer;
ALTER TABLE public.risk_mappings ADD COLUMN IF NOT EXISTS risk_id varchar(50);
ALTER TABLE public.risk_mappings ADD COLUMN IF NOT EXISTS risk_title varchar(500);
ALTER TABLE public.risk_mappings ADD COLUMN IF NOT EXISTS risk_domain varchar(100);
ALTER TABLE public.risk_mappings ADD COLUMN IF NOT EXISTS risk_description text;
ALTER TABLE public.risk_mappings ADD COLUMN IF NOT EXISTS mitigation_action_id varchar(100);
ALTER TABLE public.risk_mappings ADD COLUMN IF NOT EXISTS mitigation_action_name varchar(500);
ALTER TABLE public.risk_mappings ADD COLUMN IF NOT EXISTS mitigation_category varchar(200);
ALTER TABLE public.risk_mappings ADD COLUMN IF NOT EXISTS mitigation_definition text;
ALTER TABLE public.risk_mappings ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now() NOT NULL;

COMMENT ON TABLE public.risk_mappings IS 'Data from Shared Enhanced Risk Database Jan 2026.xlsx; risk rows and risk-mitigation mapping rows.';

CREATE INDEX IF NOT EXISTS idx_risk_mappings_risk_id ON public.risk_mappings (risk_id);
CREATE INDEX IF NOT EXISTS idx_risk_mappings_mapping_id ON public.risk_mappings (mapping_id) WHERE mapping_id IS NOT NULL;
