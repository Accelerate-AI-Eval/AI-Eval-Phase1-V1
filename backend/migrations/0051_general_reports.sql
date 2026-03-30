-- Generated general reports (e.g. Executive Stakeholder Brief) per assessment.
-- Stores assessment_id, report_type, content, created_at, created_by.
CREATE TABLE IF NOT EXISTS general_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  organization_id varchar(255) NOT NULL,
  report_type varchar(255) NOT NULL,
  content text,
  assessment_label varchar(500),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by integer NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_general_reports_org_id ON general_reports(organization_id);
CREATE INDEX IF NOT EXISTS idx_general_reports_assessment_id ON general_reports(assessment_id);
CREATE INDEX IF NOT EXISTS idx_general_reports_created_at ON general_reports(created_at DESC);

COMMENT ON TABLE general_reports IS 'Generated general reports (e.g. Executive Stakeholder Brief) with assessment_id, created_at, created_by.';
