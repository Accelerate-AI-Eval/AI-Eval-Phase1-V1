-- Drop risk_mappings table. Recreate and populate by running: npm run seed-risk-mappings
-- (seed script reads "Shared Enhanced Risk Database Jan 2026.xlsx" and recreates the table with Excel data.)

DROP TABLE IF EXISTS public.risk_mappings CASCADE;
