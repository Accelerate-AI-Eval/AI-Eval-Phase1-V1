/**
 * Run only migration 0027: place regulatory_requirements_other next to
 * regulatory_requirements and customer_specific_risks_other next to
 * customer_specific_risks in cots_vendor_assessments.
 *
 * Usage (from backend): node migrations/run-0027-only.js
 */
import { readFileSync } from "fs";
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

const client = new pg.Client({ connectionString });
const sql = readFileSync(
  join(__dirname, "0027_vendor_cots_other_columns_reorder.sql"),
  "utf8"
);

client
  .connect()
  .then(() => client.query(sql))
  .then(() => {
    console.log("OK: 0027_vendor_cots_other_columns_reorder.sql");
    client.end();
  })
  .catch((err) => {
    console.error("Migration failed:", err.message);
    client.end();
    process.exit(1);
  });
