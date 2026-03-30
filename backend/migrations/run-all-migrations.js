/**
 * Run all migrations in order (0000 through 0027).
 * Use this if you have an existing DB that was created with older migrations and need to bring it up to date.
 * For a completely fresh DB, prefer: node migrations/run-bootstrap.js
 *
 * Usage (from backend): node migrations/run-all-migrations.js
 */
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import pg from "pg";
import { config } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.local") });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set in .env.local");
  process.exit(1);
}

const MIGRATIONS = [
  "0000_charming_spectrum.sql",
  "0001_add_user_id_and_unique_org.sql",
  "0002_organization_id_varchar.sql",
  "0003_vendor_self_attestation_user_id.sql",
  "0004_vendor_self_attestation_document_uploads.sql",
  "0005_assessments_organization_id_varchar.sql",
  "0006_vendor_self_attestation_status.sql",
  "0007_attestations_table.sql",
  "0008_sectors_and_industries.sql",
  "0009_buyer_cots_excel_mapping.sql",
  "0010_vendor_self_attestation_excel_mapping.sql",
  "0011_sectors_industries_excel_as_is.sql",
  "0012_excel_natural_keys_and_sync.sql",
  "0013_reorder_columns_excel.sql",
  "0014_create_vendor_self_attestations_if_missing.sql",
  "0015_create_sectors_industries_if_missing.sql",
  "0016_create_cots_buyer_assessments_if_missing.sql",
  "0017_ensure_industries_table_public.sql",
  "0018_ensure_vendor_self_attestations_public.sql",
  "0019_vendor_public_directory_listing.sql",
  "0020_product_name_vendor_self_attestation.sql",
  "0021_visible_to_buyer_vendor_self_attestation.sql",
  "0022_section_visibility_vendor_self_attestation.sql",
  "0023_ai_eval_org_and_users_organization_id.sql",
  "0024_integrate_system_other_buyer_cots.sql",
  "0025_integrate_system_other_next_to_integrate_system.sql",
  "0026_vendor_cots_other_columns.sql",
  "0027_vendor_cots_other_columns_reorder.sql",
];

const client = new pg.Client({ connectionString });

async function run() {
  try {
    await client.connect();
    for (const name of MIGRATIONS) {
      const path = join(__dirname, name);
      if (!existsSync(path)) {
        console.warn("Skip (not found):", name);
        continue;
      }
      const sql = readFileSync(path, "utf8");
      await client.query(sql);
      console.log("OK:", name);
    }
    console.log("All migrations completed.");
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
