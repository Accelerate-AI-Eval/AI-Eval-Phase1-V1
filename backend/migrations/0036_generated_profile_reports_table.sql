-- Table to store generated product profile reports per user/org/attestation.
-- Populated when user calls POST /vendorSelfAttestation/generate-profile (and optionally links an attestation_id).
CREATE TABLE IF NOT EXISTS generated_profile_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id varchar(255),
  attestation_id uuid REFERENCES vendor_self_attestations(id) ON DELETE SET NULL,
  trust_score integer NOT NULL,
  report jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_generated_profile_reports_user_id ON generated_profile_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_generated_profile_reports_org_id ON generated_profile_reports(organization_id);
CREATE INDEX IF NOT EXISTS idx_generated_profile_reports_attestation_id ON generated_profile_reports(attestation_id);
CREATE INDEX IF NOT EXISTS idx_generated_profile_reports_created_at ON generated_profile_reports(created_at DESC);

COMMENT ON TABLE generated_profile_reports IS 'Stored AI-generated product profile reports (trust score + sections) per user, org, and optional attestation.';
