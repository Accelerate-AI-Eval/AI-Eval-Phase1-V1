-- Add vendor_name to vendor_onboarding (Company Profile).
ALTER TABLE public.vendor_onboarding
  ADD COLUMN IF NOT EXISTS vendor_name varchar(255);
