/**
 * Run bootstrap.sql – full schema (enums, all tables in public, sectors/industries seed).
 * Use this for a fresh database or to ensure all tables exist with correct columns.
 * Usage (from backend): node migrations/run-bootstrap.js
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

const sqlPath = join(__dirname, "bootstrap.sql");
const sql = readFileSync(sqlPath, "utf8");
const client = new pg.Client({ connectionString });

async function run() {
  try {
    await client.connect();
    await client.query(sql);
    console.log("Bootstrap completed. All tables and seed data are in place.");
  } catch (err) {
    console.error("Bootstrap failed:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
