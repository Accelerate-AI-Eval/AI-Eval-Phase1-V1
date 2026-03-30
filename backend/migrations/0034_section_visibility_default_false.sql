-- Section visibility to buyers: default OFF for new and existing rows.
ALTER TABLE public.vendor_self_attestations ALTER COLUMN visible_ai_governance SET DEFAULT false;
ALTER TABLE public.vendor_self_attestations ALTER COLUMN visible_security_posture SET DEFAULT false;
ALTER TABLE public.vendor_self_attestations ALTER COLUMN visible_data_privacy SET DEFAULT false;
ALTER TABLE public.vendor_self_attestations ALTER COLUMN visible_compliance SET DEFAULT false;
ALTER TABLE public.vendor_self_attestations ALTER COLUMN visible_model_risk SET DEFAULT false;

UPDATE public.vendor_self_attestations
SET
  visible_ai_governance = false,
  visible_security_posture = false,
  visible_data_privacy = false,
  visible_compliance = false,
  visible_model_risk = false
WHERE visible_ai_governance = true
   OR visible_security_posture = true
   OR visible_data_privacy = true
   OR visible_compliance = true
   OR visible_model_risk = true;
