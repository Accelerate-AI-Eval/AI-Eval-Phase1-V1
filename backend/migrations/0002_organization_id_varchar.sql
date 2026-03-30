-- Store org id from frontend (organizations.id is integer); allow varchar for organization_id.
ALTER TABLE "vendor_onboarding" ALTER COLUMN "organization_id" TYPE varchar(255) USING "organization_id"::text;
--> statement-breakpoint
ALTER TABLE "buyer_onboarding" ALTER COLUMN "organization_id" TYPE varchar(255) USING "organization_id"::text;
