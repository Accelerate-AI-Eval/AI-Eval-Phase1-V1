/**
 * Run only migration 0024: add integrate_system_other to cots_buyer_assessments.
 * Use when you only need the buyer COTS "Other (Specify Below)" column.
 *
 * Usage (from backend): node migrations/run-0024-only.js
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
const sql = readFileSync(join(__dirname, "0024_integrate_system_other_buyer_cots.sql"), "utf8");

client
  .connect()
  .then(() => client.query(sql))
  .then(() => {
    console.log("OK: 0024_integrate_system_other_buyer_cots.sql");
    client.end();
  })
  .catch((err) => {
    console.error("Migration failed:", err.message);
    client.end();
    process.exit(1);
  });
