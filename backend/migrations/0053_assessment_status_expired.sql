-- Add 'expired' to assessment_status enum so assessments can be marked expired in DB when expiry_at has passed.
ALTER TYPE assessment_status ADD VALUE IF NOT EXISTS 'expired';

COMMENT ON TYPE assessment_status IS 'draft, submitted, expired (set when expiry_at has passed)';
