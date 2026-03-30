-- Add expiry_at to vendor_self_attestations: 3 months from created_at.
-- Backfill existing rows, then trigger sets it on new inserts.

ALTER TABLE vendor_self_attestations
  ADD COLUMN IF NOT EXISTS expiry_at timestamptz;

UPDATE vendor_self_attestations
  SET expiry_at = created_at + interval '3 months'
  WHERE expiry_at IS NULL;

CREATE OR REPLACE FUNCTION set_vendor_self_attestation_expiry_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.expiry_at := NEW.created_at + interval '3 months';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_vendor_self_attestation_set_expiry ON vendor_self_attestations;
CREATE TRIGGER trigger_vendor_self_attestation_set_expiry
  BEFORE INSERT ON vendor_self_attestations
  FOR EACH ROW
  EXECUTE PROCEDURE set_vendor_self_attestation_expiry_at();

COMMENT ON COLUMN vendor_self_attestations.expiry_at IS 'Expiry date: 3 months from created_at (set by trigger on insert).';
