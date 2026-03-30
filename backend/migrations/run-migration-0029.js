/**
 * One-time script to run 0029_user_onboarding_status.sql
 * Adds onboarding_status (completed / expired / pending).
 * - completed: user_onboarding_completed = true
 * - expired: account_status = invited and invite link past 7 days
 * Usage (from backend folder): node migrations/run-migration-0029.js
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import pg from "pg";
import { config } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.local") });
config({ path: join(__dirname, "..", ".env") });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set (check .env or .env.local)");
  process.exit(1);
}

const sqlPath = join(__dirname, "0029_user_onboarding_status.sql");
const sql = readFileSync(sqlPath, "utf8");

const client = new pg.Client({ connectionString });

async function run() {
  try {
    await client.connect();
    await client.query(sql);
    console.log("Migration 0029_user_onboarding_status.sql completed successfully.");
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
