/**
 * One-time script to run 0040_customer_risk_assessment_reports.sql
 * Creates customer_risk_assessment_reports table for Customer Risk Assessment reports.
 *
 * Usage (from backend folder):
 *   node migrations/run-migration-0040.js
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
  const password = process.env.DATABASE_PASSWORD ?? "Postgresql123";
  const host = process.env.DATABASE_HOST ?? "localhost";
  const port = process.env.DATABASE_PORT ?? "5432";
  const database = process.env.DATABASE_NAME ?? "ai_eval_db";
  connectionString = `postgresql://${user}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

const sqlPath = join(__dirname, "0040_customer_risk_assessment_reports.sql");
const sql = readFileSync(sqlPath, "utf8");

const client = new pg.Client({ connectionString });

async function run() {
  try {
    await client.connect();
    await client.query(sql);
    console.log("Migration 0040_customer_risk_assessment_reports.sql completed successfully.");
  } catch (err) {
    const msg = err && typeof err.message === "string" ? err.message : String(err);
    console.error("Migration failed:", msg);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
