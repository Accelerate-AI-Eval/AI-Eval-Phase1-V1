/**
 * Run 0018_ensure_vendor_self_attestations_public.sql
 * Ensures vendor_self_attestations exists in public schema (fixes table not visible in pgAdmin).
 * Usage (from backend): node migrations/run-migration-0018.js
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

const sqlPath = join(__dirname, "0018_ensure_vendor_self_attestations_public.sql");
const sql = readFileSync(sqlPath, "utf8");
const client = new pg.Client({ connectionString });

async function run() {
  try {
    await client.connect();
    await client.query(sql);
    console.log("Migration 0018 completed. vendor_self_attestations is in public schema. Refresh pgAdmin tree.");
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
