/**
 * Run 0054_vendor_self_attestations_compliance_doc_expiries.sql
 * Usage (from backend): node migrations/run-migration-0054.js
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import pg from "pg";
import { config } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.local") });
config({ path: join(__dirname, "..", ".env") });

const connectionString =
  process.argv[2] ||
  process.env.DATABASE_URL ||
  `postgresql://${process.env.DATABASE_USER ?? "postgres"}:${encodeURIComponent(process.env.DATABASE_PASSWORD ?? "Postgresql123")}@${process.env.DATABASE_HOST ?? "localhost"}:${process.env.DATABASE_PORT ?? "5432"}/${process.env.DATABASE_NAME ?? "ai_eval_db"}`;

const client = new pg.Client({ connectionString });
const sqlPath = join(__dirname, "0054_vendor_self_attestations_compliance_doc_expiries.sql");
const sql = readFileSync(sqlPath, "utf8");

async function run() {
  try {
    await client.connect();
    await client.query(sql);
    console.log("Migration 0054 completed (compliance_document_expiries).");
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
