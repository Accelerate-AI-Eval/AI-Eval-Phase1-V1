-- Add public_directory_listing to vendor_onboarding so vendors can opt in to the buyer-facing directory.
ALTER TABLE public.vendor_onboarding
  ADD COLUMN IF NOT EXISTS public_directory_listing boolean NOT NULL DEFAULT false;
