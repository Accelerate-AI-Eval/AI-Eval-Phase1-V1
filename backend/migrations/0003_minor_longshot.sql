ALTER TABLE "buyer_onboarding" ALTER COLUMN "organization_id" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "vendor_onboarding" ALTER COLUMN "organization_id" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "vendor_self_attestations" ALTER COLUMN "assessment_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "buyer_onboarding" ADD COLUMN IF NOT EXISTS "user_id" integer;--> statement-breakpoint
ALTER TABLE "cots_buyer_assessments" ADD COLUMN IF NOT EXISTS "risk_mitigation_mapping_ids" jsonb;--> statement-breakpoint
ALTER TABLE "vendor_onboarding" ADD COLUMN IF NOT EXISTS "user_id" integer;--> statement-breakpoint
ALTER TABLE "vendor_self_attestations" ADD COLUMN IF NOT EXISTS "user_id" integer;--> statement-breakpoint
ALTER TABLE "vendor_self_attestations" ADD COLUMN IF NOT EXISTS "document_uploads" jsonb;--> statement-breakpoint
ALTER TABLE "buyer_onboarding" DROP CONSTRAINT IF EXISTS "buyer_onboarding_organization_id_unique";--> statement-breakpoint
ALTER TABLE "buyer_onboarding" ADD CONSTRAINT "buyer_onboarding_organization_id_unique" UNIQUE("organization_id");--> statement-breakpoint
ALTER TABLE "vendor_onboarding" DROP CONSTRAINT IF EXISTS "vendor_onboarding_organization_id_unique";--> statement-breakpoint
ALTER TABLE "vendor_onboarding" ADD CONSTRAINT "vendor_onboarding_organization_id_unique" UNIQUE("organization_id");