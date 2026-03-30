-- Per-file parsed expiry dates for compliance certification uploads (slot 2 byCategory).
ALTER TABLE vendor_self_attestations
  ADD COLUMN IF NOT EXISTS compliance_document_expiries jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN vendor_self_attestations.compliance_document_expiries IS
  'Map fileName -> { category, expiryAt ISO or null, parsedAt, error? } from post-submit document parsing';
