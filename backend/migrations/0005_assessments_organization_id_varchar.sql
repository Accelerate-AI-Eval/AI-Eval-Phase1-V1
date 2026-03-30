-- Align assessments.organization_id with app usage: frontend sends string (org name or id from session).
-- buyer_onboarding and vendor_onboarding already use varchar(255) for organization_id.
ALTER TABLE "assessments" ALTER COLUMN "organization_id" SET DATA TYPE varchar(255) USING "organization_id"::text;
