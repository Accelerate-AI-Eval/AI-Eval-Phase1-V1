-- Add generated_profile_report to vendor_self_attestations for storing AI-generated product profile (trust score + sections) when attestation is submitted.
ALTER TABLE vendor_self_attestations
ADD COLUMN IF NOT EXISTS generated_profile_report jsonb;

COMMENT ON COLUMN vendor_self_attestations.generated_profile_report IS 'Generated product profile report (trustScore + sections) when attestation is submitted as COMPLETED.';
