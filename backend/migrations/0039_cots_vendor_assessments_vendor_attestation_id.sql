-- Vendor COTS assessment: link to a completed vendor self-attestation (product).
-- Used by Solution Fit "Product" dropdown (vendor's completed products).

ALTER TABLE "cots_vendor_assessments"
  ADD COLUMN IF NOT EXISTS "vendor_attestation_id" uuid DEFAULT NULL;

COMMENT ON COLUMN "cots_vendor_assessments"."vendor_attestation_id" IS 'Vendor self-attestation (product) this assessment is for; from completed attestations.';
