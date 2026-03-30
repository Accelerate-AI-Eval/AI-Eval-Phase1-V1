/**
 * One-time script to run 0036_generated_profile_reports_table.sql
 * Creates generated_profile_reports table for storing reports by user/org/attestation.
 *
 * Usage (from backend folder):
 *   node migrations/run-migration-0036.js
 *   node migrations/run-migration-0036.js "postgresql://user:password@host:5432/dbname"
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import pg from "pg";
import { config } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.local") });
config({ path: join(__dirname, "..", ".env") });

let connectionString = process.argv[2] || process.env.DATABASE_URL;
if (!connectionString) {
  const user = process.env.DATABASE_USER ?? "postgres";
  const password = process.env.DATABASE_PASSWORD ?? "Thulasi@1612";
  const host = process.env.DATABASE_HOST ?? "localhost";
  const port = process.env.DATABASE_PORT ?? "5432";
  const database = process.env.DATABASE_NAME ?? "new_ai_eval_db";
  connectionString = `postgresql://${user}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

const sqlPath = join(__dirname, "0036_generated_profile_reports_table.sql");
const sql = readFileSync(sqlPath, "utf8");

const client = new pg.Client({ connectionString });

async function run() {
  try {
    await client.connect();
    await client.query(sql);
    console.log("Migration 0036_generated_profile_reports_table.sql completed successfully.");
  } catch (err) {
    const msg = err && typeof err.message === "string" ? err.message : String(err);
    console.error("Migration failed:", msg);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
