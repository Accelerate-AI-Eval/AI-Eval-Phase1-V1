-- Full vendor risk assessment report (JSON) generated on buyer COTS submit.
ALTER TABLE cots_buyer_assessments
  ADD COLUMN IF NOT EXISTS vendor_risk_assessment_report jsonb;

COMMENT ON COLUMN cots_buyer_assessments.vendor_risk_assessment_report IS
  'LLM-generated Vendor Risk Assessment Report: scores, strengths, risks, recommendations, implementation notes';
