/**
 * One-time script to run 0031_generated_profile_report_vendor_self_attestations.sql
 * Adds generated_profile_report column to vendor_self_attestations.
 *
 * Usage (from backend folder):
 *   node migrations/run-migration-0031.js
 *   node migrations/run-migration-0031.js "postgresql://user:password@host:5432/dbname"
 *
 * Credentials: from .env.local (DATABASE_URL or DATABASE_USER/PASSWORD/HOST/PORT/NAME),
 * or pass full connection string as first argument.
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

const sqlPath = join(__dirname, "0031_generated_profile_report_vendor_self_attestations.sql");
const sql = readFileSync(sqlPath, "utf8");

const client = new pg.Client({ connectionString });

async function run() {
  try {
    await client.connect();
    await client.query(sql);
    console.log("Migration 0031_generated_profile_report_vendor_self_attestations.sql completed successfully.");
  } catch (err) {
    const msg = err && typeof err.message === "string" ? err.message : String(err);
    console.error("Migration failed:", msg);
    if (msg.includes("password authentication failed")) {
      console.error("\nThis usually means the password in .env.local (DATABASE_PASSWORD) does not match");
      console.error("your Postgres server. Fix it by either:\n");
      console.error("  1. Set DATABASE_PASSWORD in backend/.env.local to your actual postgres password.");
      console.error("  2. Or run with a connection string:\n");
      console.error('     node migrations/run-migration-0031.js "postgresql://postgres:YOUR_PASSWORD@localhost:5432/new_ai_eval_db"\n');
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
