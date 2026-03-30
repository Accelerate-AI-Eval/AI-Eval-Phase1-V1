-- Add status column to vendor_self_attestations: 'DRAFT' | 'COMPLETED'
-- Step 1: Add column (existing rows get NULL)
ALTER TABLE "vendor_self_attestations" ADD COLUMN IF NOT EXISTS "status" varchar(20);
-- Step 2: Treat existing rows as fully submitted
UPDATE "vendor_self_attestations" SET status = 'COMPLETED' WHERE status IS NULL;
-- Step 3: Default for new inserts
ALTER TABLE "vendor_self_attestations" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
