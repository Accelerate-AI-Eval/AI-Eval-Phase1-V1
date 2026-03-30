-- Add Excel natural key columns (vendor_self_attestation_id, buyer_cots_id) for sync/upsert.
-- Do not add surrogate IDs; use Excel columns as-is. Existing tables keep relationships.

-- vendor_self_attestation sheet: add vendor_self_attestation_id (natural key from Excel)
ALTER TABLE "vendor_self_attestations"
  ADD COLUMN IF NOT EXISTS "vendor_self_attestation_id" uuid UNIQUE DEFAULT gen_random_uuid();

UPDATE "vendor_self_attestations"
SET "vendor_self_attestation_id" = "id"
WHERE "vendor_self_attestation_id" IS NULL;

-- buyer_cots sheet: add buyer_cots_id (natural key from Excel)
ALTER TABLE "cots_buyer_assessments"
  ADD COLUMN IF NOT EXISTS "buyer_cots_id" uuid UNIQUE DEFAULT gen_random_uuid();

UPDATE "cots_buyer_assessments"
SET "buyer_cots_id" = "id"
WHERE "buyer_cots_id" IS NULL;
