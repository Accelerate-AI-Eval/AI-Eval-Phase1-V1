/**
 * Run only migration 0025: place integrate_system_other next to integrate_system.
 * Adds the column if missing, then recreates cots_buyer_assessments with correct column order.
 *
 * Usage (from backend): node migrations/run-0025-only.js
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
  join(__dirname, "0025_integrate_system_other_next_to_integrate_system.sql"),
  "utf8"
);

client
  .connect()
  .then(() => client.query(sql))
  .then(() => {
    console.log("OK: 0025_integrate_system_other_next_to_integrate_system.sql");
    client.end();
  })
  .catch((err) => {
    console.error("Migration failed:", err.message);
    client.end();
    process.exit(1);
  });
