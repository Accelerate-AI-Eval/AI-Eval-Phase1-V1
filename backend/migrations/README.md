# Migrations

**Windows PowerShell 5.x:** `&&` is not supported between commands. Use `;` instead (for example `cd backend; npm run db:migrate`) or run commands on separate lines. PowerShell 7+ and Command Prompt support `&&`.

## Quick start: full schema and seed data

- **Fresh or clean database:** from the `backend` folder run:
  ```bash
  node migrations/run-bootstrap.js
  ```
  This applies `bootstrap.sql`: creates all enums and tables in `public` with the correct columns and seeds **sectors** and **industries**. Safe to run on an empty DB; on an existing DB it only creates missing objects (it does not alter existing tables).

- **Existing DB that was built from older migrations:** to bring it up to date with all incremental changes (0000 → 0018), run:
  ```bash
  node migrations/run-all-migrations.js
  ```
  Use this when you already ran 0000, 0001, etc. and need to apply the rest. For a completely fresh DB, prefer `run-bootstrap.js` instead.

---

- **Use `npm run db:migrate`** to apply migrations (Drizzle’s default migration entry point). The migration `0000_charming_spectrum.sql` is safe to run multiple times (enums created only if missing, tables use `IF NOT EXISTS`).

- **Do not run `npm run db:generate`** before migrating if you want to keep this safe migration. Generate overwrites existing migration files with plain `CREATE TYPE` / `CREATE TABLE`, which will fail if types or tables already exist.

- For **new** schema changes: change the schema in code, then run `db:generate` to create a **new** migration file (e.g. `0001_xxx.sql`). Then run `db:migrate`.

- **Use `db:migrate`**, not `db:push`, if your database does not support the `serial` type (e.g. some serverless Postgres). Push generates SQL that may use `serial`.

- **Migration `0001_add_user_id_and_unique_org.sql`**: Adds `user_id` to `vendor_onboarding` and `buyer_onboarding`, and enforces one onboarding per org (unique index on `organization_id`). If you already have duplicate `organization_id` rows, fix or remove duplicates before running this migration.

- **Migration `0006_vendor_self_attestation_status.sql`**: Adds `status` to `vendor_self_attestations` so draft vs completed is persisted in the DB (`'draft'` = Save draft, `'submitted'` = Submit). Run this so attestation details page shows Draft/Completed correctly. Apply with `npm run db:migrate` or run the SQL manually against your database.

- **Migration `0008_sectors_and_industries.sql`**: Creates `sectors` and `industries` lookup tables and **seeds all sector/industry data** (Public Sector, Private Sector, Non-Profit and their industries). Run **`npm run db:run-0008`** from the backend folder to add this data to the database.

- **Migration `0009_buyer_cots_excel_mapping.sql`**: Aligns `cots_buyer_assessments` with the Excel "buyer_cots" sheet (adds new columns and renames existing ones). API/UI stay the same; backend maps camelCase to/from these column names. Run **`node migrations/run-migration-0009.js`** from the backend folder (uses `DATABASE_URL` from `.env.local`).

- **Migration `0010_vendor_self_attestation_excel_mapping.sql`**: Aligns `vendor_self_attestations` with the Excel "vendor_self_attestation" sheet (adds new columns and renames existing ones). API/UI response shape unchanged; backend maps to/from these column names. Run **`node migrations/run-migration-0010.js`** from the backend folder (uses `DATABASE_URL` from `.env.local`).

- **Migration `0011_sectors_industries_excel_as_is.sql`**: Replaces `sectors` and `industries` with the Excel "Industry_sectors" sheet structure as-is (integer IDs only, no UUIDs). Tables: **sectors**(industry_id, industry_name), **industries**(industry_sector_id, industry_id, sector_name). Run **`node migrations/run-migration-0011.js`** from the backend folder.

- **Migration `0012_excel_natural_keys_and_sync.sql`**: Adds Excel natural key columns: **vendor_self_attestation_id** (unique) to `vendor_self_attestations`, **buyer_cots_id** (unique) to `cots_buyer_assessments`. No surrogate IDs; use Excel columns as-is for sync. Run **`node migrations/run-migration-0012.js`** from the backend folder.

- **Migration `0013_reorder_columns_excel.sql`**: Recreates `vendor_self_attestations` and `cots_buyer_assessments` with columns in the same order as the DB Schema Mapping Excel sheets (nested sheets). Run **`node migrations/run-migration-0013.js`** from the backend folder (run after 0010 and 0012).

- **Migration `0014_create_vendor_self_attestations_if_missing.sql`**: Creates **vendor_self_attestations** table if it does not exist (Excel-aligned structure). Safe to run anytime. Run **`node migrations/run-migration-0014.js`** from the backend folder.

- **Migration `0015_create_sectors_industries_if_missing.sql`**: Creates **sectors** and **industries** tables if they do not exist (Excel "Industry_sectors" structure); seeds data with ON CONFLICT DO NOTHING (no duplicates). Safe to run anytime. Run **`node migrations/run-migration-0015.js`** from the backend folder.

- **Migration `0016_create_cots_buyer_assessments_if_missing.sql`**: Creates **cots_buyer_assessments** table if it does not exist (Excel "buyer_cots" structure). Requires **assessments** table. Run **`node migrations/run-migration-0016.js`** from the backend folder.

- **Migration `0042_risk_mappings_unique_constraints.sql`**: Adds unique constraint on **risks**(risk_id) and unique index on **risk_top5_mitigations**(mapping_id, risk_id). Optional if you only use **risk_mappings** for Excel data.

- **Migration `0043_risk_mappings_table.sql`**: Creates **risk_mappings** table for "Shared Enhanced Risk Database Jan 2026.xlsx" data. Run **`node migrations/run-migration-0043.js`** from the backend folder, then **`npm run seed-risk-mappings`** to load the Excel into **risk_mappings** (all sheets: risk rows and mapping rows).
