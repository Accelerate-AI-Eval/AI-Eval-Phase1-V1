-- submitted_at: when attestation was first submitted (COMPLETED). Not updated by visibility toggles.
ALTER TABLE public.vendor_self_attestations
  ADD COLUMN IF NOT EXISTS submitted_at timestamp with time zone;

-- Backfill: for existing COMPLETED rows, set submitted_at = updated_at so "Submitted" date is stable
UPDATE public.vendor_self_attestations
SET submitted_at = updated_at
WHERE upper(coalesce(status, '')) = 'COMPLETED' AND submitted_at IS NULL;
