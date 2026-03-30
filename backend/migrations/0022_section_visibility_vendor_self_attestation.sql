-- Per-section visibility to buyers: only sections with toggle on are shown in buyer product detail.
ALTER TABLE public.vendor_self_attestations ADD COLUMN IF NOT EXISTS visible_ai_governance boolean NOT NULL DEFAULT true;
ALTER TABLE public.vendor_self_attestations ADD COLUMN IF NOT EXISTS visible_security_posture boolean NOT NULL DEFAULT true;
ALTER TABLE public.vendor_self_attestations ADD COLUMN IF NOT EXISTS visible_data_privacy boolean NOT NULL DEFAULT true;
ALTER TABLE public.vendor_self_attestations ADD COLUMN IF NOT EXISTS visible_compliance boolean NOT NULL DEFAULT true;
ALTER TABLE public.vendor_self_attestations ADD COLUMN IF NOT EXISTS visible_model_risk boolean NOT NULL DEFAULT true;
