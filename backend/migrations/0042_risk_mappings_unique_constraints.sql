-- Allow upsert when seeding risks and risk_top5_mitigations from Excel (Shared Enhanced Risk Database).
-- risks: upsert by risk_id
-- risk_top5_mitigations: upsert by (mapping_id, risk_id)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'risks_risk_id_unique') THEN
    ALTER TABLE public.risks ADD CONSTRAINT risks_risk_id_unique UNIQUE (risk_id);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS risk_top5_mitigations_mapping_risk_unique
  ON public.risk_top5_mitigations (mapping_id, risk_id);

COMMENT ON CONSTRAINT risks_risk_id_unique ON public.risks IS 'Natural key for seeding from Excel risk database; enables ON CONFLICT (risk_id) DO UPDATE.';
