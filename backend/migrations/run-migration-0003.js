/**
 * One-time script to run 0003_vendor_self_attestation_user_id.sql
 * Usage (from backend folder): node migrations/run-migration-0003.js
 * Uses DATABASE_URL from .env.local (same as db.ts)
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

const sqlPath = join(__dirname, "0003_vendor_self_attestation_user_id.sql");
const sql = readFileSync(sqlPath, "utf8");

const client = new pg.Client({ connectionString });

async function run() {
  try {
    await client.connect();
    await client.query(sql);
    console.log("Migration 0003_vendor_self_attestation_user_id.sql completed successfully.");
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
