-- Store document upload metadata (file names) per slot for vendor self attestation
ALTER TABLE "vendor_self_attestations" ADD COLUMN IF NOT EXISTS "document_uploads" jsonb;
