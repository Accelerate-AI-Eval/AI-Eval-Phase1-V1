/**
 * One-time script to run 0034_section_visibility_default_false.sql
 * Sets section visibility defaults to false for vendor_self_attestations.
 * Usage (from backend folder): node migrations/run-migration-0034.js
 * Connection: DATABASE_URL from .env/.env.local, or built from DATABASE_* (same as run-migration-0033).
 */
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import pg from "pg";
import { config } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const envPath = join(root, ".env");
const envLocalPath = join(root, ".env.local");
if (existsSync(envPath)) config({ path: envPath });
if (existsSync(envLocalPath)) config({ path: envLocalPath });

let connectionString = process.env.DATABASE_URL;
if (!connectionString || connectionString.trim() === "") {
  const user = process.env.DATABASE_USER ?? "postgres";
  const password = process.env.DATABASE_PASSWORD ?? "";
  const host = process.env.DATABASE_HOST ?? "localhost";
  const port = process.env.DATABASE_PORT ?? "5432";
  const database = process.env.DATABASE_NAME ?? "ai_eval_db";
  connectionString = `postgresql://${user}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

const sqlPath = join(__dirname, "0034_section_visibility_default_false.sql");
const sql = readFileSync(sqlPath, "utf8");

const client = new pg.Client({ connectionString });

async function run() {
  try {
    await client.connect();
    await client.query(sql);
    console.log("Migration 0034_section_visibility_default_false.sql completed successfully.");
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
