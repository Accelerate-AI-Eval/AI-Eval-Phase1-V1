-- Visibility to buyers for generated report sections 6-9.
ALTER TABLE public.vendor_self_attestations ADD COLUMN IF NOT EXISTS visible_section_6 boolean NOT NULL DEFAULT false;
ALTER TABLE public.vendor_self_attestations ADD COLUMN IF NOT EXISTS visible_section_7 boolean NOT NULL DEFAULT false;
ALTER TABLE public.vendor_self_attestations ADD COLUMN IF NOT EXISTS visible_section_8 boolean NOT NULL DEFAULT false;
ALTER TABLE public.vendor_self_attestations ADD COLUMN IF NOT EXISTS visible_section_9 boolean NOT NULL DEFAULT false;
