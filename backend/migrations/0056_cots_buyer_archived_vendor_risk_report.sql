-- Snapshot of vendor risk report when buyer assessment expires (live column cleared by app).
ALTER TABLE cots_buyer_assessments
  ADD COLUMN IF NOT EXISTS archived_vendor_risk_assessment_report jsonb;

COMMENT ON COLUMN cots_buyer_assessments.archived_vendor_risk_assessment_report IS
  'Frozen copy of vendor_risk_assessment_report after assessment status becomes expired';
