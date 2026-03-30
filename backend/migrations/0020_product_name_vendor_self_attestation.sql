-- Add product_name to vendor_self_attestations for Product Profile display on attestation cards.
ALTER TABLE public.vendor_self_attestations
  ADD COLUMN IF NOT EXISTS product_name varchar(255);
