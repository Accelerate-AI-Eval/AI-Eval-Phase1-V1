-- Add expiry_at to assessments: 3 months from created_at.
-- Backfill existing rows, then trigger sets it on new inserts.

ALTER TABLE assessments
  ADD COLUMN IF NOT EXISTS expiry_at timestamptz;

UPDATE assessments
  SET expiry_at = created_at + interval '3 months'
  WHERE expiry_at IS NULL;

CREATE OR REPLACE FUNCTION set_assessment_expiry_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.expiry_at := NEW.created_at + interval '3 months';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_assessment_set_expiry ON assessments;
CREATE TRIGGER trigger_assessment_set_expiry
  BEFORE INSERT ON assessments
  FOR EACH ROW
  EXECUTE PROCEDURE set_assessment_expiry_at();
