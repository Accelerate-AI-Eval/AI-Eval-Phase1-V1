-- Per-product visibility to buyers: only completed products with visible_to_buyer true are shown when buyer views vendor.
ALTER TABLE public.vendor_self_attestations
  ADD COLUMN IF NOT EXISTS visible_to_buyer boolean NOT NULL DEFAULT false;
