/**
 * Run 0045_risk_mappings_new_schema.sql — drop risk_mappings and create with new columns.
 * Then run: npm run seed-risk-mappings (to load Excel data).
 *
 * Usage (from backend folder): node migrations/run-migration-0045.js
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

const client = new pg.Client({ connectionString });
const sqlPath = join(__dirname, "0045_risk_mappings_new_schema.sql");
const sql = readFileSync(sqlPath, "utf8");

async function run() {
  try {
    await client.connect();
    await client.query(sql);
    console.log("Migration 0045_risk_mappings_new_schema.sql completed. Run: npm run seed-risk-mappings");
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
