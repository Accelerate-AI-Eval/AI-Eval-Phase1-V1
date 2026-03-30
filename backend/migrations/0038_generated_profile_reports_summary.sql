-- Store the generated trust score summary in a dedicated column for querying and display.
ALTER TABLE generated_profile_reports
  ADD COLUMN IF NOT EXISTS summary text;

COMMENT ON COLUMN generated_profile_reports.summary IS 'Generated trust score summary text (content after **Summary:** from the report).';
