/**
 * Extract text from compliance PDFs (pdf-parse-new) and infer certificate/report expiry dates.
 * Used after vendor attestation submit (COMPLETED) for slot-2 categorized compliance documents.
 */
import * as fs from "fs";
import * as path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse-new") as (
  dataBuffer: Buffer,
  options?: { verbosityLevel?: number },
) => Promise<{ text?: string }>;
import { db } from "../database/db.js";
import { vendorSelfAttestations } from "../schema/schema.js";
import { eq } from "drizzle-orm";

const UPLOADS_DIR = path.resolve(process.cwd(), "public", "uploads_vendor_attestations");

export type ComplianceDocExpiryEntry = {
  category: string;
  expiryAt: string | null;
  parsedAt: string;
  error?: string;
};

export type ComplianceDocExpiryMap = Record<string, ComplianceDocExpiryEntry>;

const MONTHS =
  "jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december";

/** Lines that suggest an expiry / validity end date (compliance certs, SOC reports). */
const EXPIRY_LINE =
  /valid\s*(?:until|through|to|from)|expir(?:es|y|ation)|certificate\s*(?:is\s*)?valid|period\s*(?:of\s*)?(?:validity|coverage)|report\s*period|audit\s*period|coverage\s*period|effective\s*(?:until|through)|remains\s*valid|due\s*for\s*renewal/i;

function padY(y: number): number {
  if (y >= 0 && y < 100) return y >= 50 ? 1900 + y : 2000 + y;
  return y;
}

function parseDateCandidate(raw: string): Date | null {
  const s = raw.trim();
  if (!s) return null;
  // ISO YYYY-MM-DD
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  // DD/MM/YYYY or MM/DD/YYYY (prefer day-first for EU certs; if first part > 12 it's DMY)
  m = s.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/);
  if (m) {
    let a = Number(m[1]);
    let b = Number(m[2]);
    let y = Number(m[3]);
    if (y < 100) y = padY(y);
    let day: number;
    let month: number;
    if (a > 12) {
      day = a;
      month = b;
    } else if (b > 12) {
      day = b;
      month = a;
    } else {
      // ambiguous: assume MM/DD (US) for SOC-style reports
      month = a;
      day = b;
    }
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const d = new Date(Date.UTC(y, month - 1, day));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  // Month DD, YYYY
  const re = new RegExp(
    `\\b(${MONTHS})\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s*(\\d{4})\\b`,
    "i",
  );
  m = s.match(re);
  if (m) {
    const d = new Date(`${m[1]} ${m[2]}, ${m[3]}`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  // DD Month YYYY
  const re2 = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTHS})\\s+(\\d{4})\\b`, "i");
  m = s.match(re2);
  if (m) {
    const d = new Date(`${m[2]} ${m[1]}, ${m[3]}`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function extractDatesFromChunk(chunk: string): Date[] {
  const out: Date[] = [];
  const isoAll = chunk.matchAll(/\b(\d{4}-\d{2}-\d{2})\b/g);
  for (const x of isoAll) {
    const d = parseDateCandidate(x[1] ?? "");
    if (d) out.push(d);
  }
  const slashAll = chunk.matchAll(/\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b/g);
  for (const x of slashAll) {
    const d = parseDateCandidate(x[0] ?? "");
    if (d) out.push(d);
  }
  const monthAll = chunk.matchAll(
    new RegExp(`\\b(?:${MONTHS})\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s*\\d{4}\\b`, "gi"),
  );
  for (const x of monthAll) {
    const d = parseDateCandidate(x[0] ?? "");
    if (d) out.push(d);
  }
  const dmyAll = chunk.matchAll(new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${MONTHS})\\s+\\d{4}\\b`, "gi"));
  for (const x of dmyAll) {
    const d = parseDateCandidate(x[0] ?? "");
    if (d) out.push(d);
  }
  return out;
}

function isReasonableCertDate(d: Date): boolean {
  const y = d.getFullYear();
  return y >= 2020 && y <= 2048;
}

/** YYYY-MM-DD in local calendar (avoids UTC off-by-one for cert wording dates). */
function toDateOnlyLocal(d: Date): string {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Pick best expiry from certificate-style text: prefer dates on/near expiry keywords, else latest reasonable date in those lines.
 */
export function extractExpiryFromText(fullText: string): Date | null {
  const text = fullText.replace(/\r\n/g, "\n").slice(0, 600_000);
  const lines = text.split("\n");
  const keywordDates: Date[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (!EXPIRY_LINE.test(line)) continue;
    const window = [line, lines[i + 1] ?? "", lines[i - 1] ?? ""].join(" ");
    const dates = extractDatesFromChunk(window).filter(isReasonableCertDate);
    for (const d of dates) keywordDates.push(d);
  }
  if (keywordDates.length > 0) {
    keywordDates.sort((a, b) => b.getTime() - a.getTime());
    return keywordDates[0] ?? null;
  }
  // Fallback: last ISO or slash date in first 80 lines (cover page often has period)
  const head = lines.slice(0, 80).join("\n");
  const headDates = extractDatesFromChunk(head).filter(isReasonableCertDate);
  if (headDates.length > 0) {
    headDates.sort((a, b) => b.getTime() - a.getTime());
    return headDates[0] ?? null;
  }
  return null;
}

async function extractTextFromFile(filePath: string, ext: string): Promise<string> {
  const buf = await fs.promises.readFile(filePath);
  const e = ext.toLowerCase();
  if (e === ".pdf") {
    const data = await pdfParse(buf, { verbosityLevel: 0 });
    return (data.text ?? "").trim();
  }
  if (e === ".docx" || e === ".doc") {
    throw new Error("Only PDF is parsed for expiry; export or upload as PDF.");
  }
  if (e === ".ppt" || e === ".pptx") {
    throw new Error("Slides are not parsed for expiry; export or upload as PDF.");
  }
  throw new Error(`Unsupported extension: ${ext}`);
}

function collectComplianceFiles(
  documentUploads: Record<string, unknown> | null | undefined,
): Array<{ fileName: string; category: string }> {
  const out: Array<{ fileName: string; category: string }> = [];
  const seen = new Set<string>();
  if (!documentUploads || typeof documentUploads !== "object") return out;
  const addFile = (rawName: string, category: string) => {
    const base = path.basename(rawName.trim());
    if (!base || base === "." || base === "..") return;
    if (path.extname(base).toLowerCase() !== ".pdf") return;
    if (seen.has(base)) return;
    seen.add(base);
    out.push({ fileName: base, category });
  };
  const addFiles = (files: unknown, category: string) => {
    if (!Array.isArray(files)) return;
    for (const f of files) {
      if (typeof f !== "string" || !f.trim()) continue;
      addFile(f, category);
    }
  };

  addFiles(documentUploads["0"], "marketing_material");
  addFiles(documentUploads["1"], "technical_material");
  addFiles(documentUploads["evidenceTestingPolicy"], "evidence_testing_policy");

  const slot2 = documentUploads["2"];
  if (slot2 != null && typeof slot2 === "object" && !Array.isArray(slot2)) {
    const byCat = (slot2 as Record<string, unknown>).byCategory;
    if (byCat && typeof byCat === "object") {
      for (const [category, files] of Object.entries(byCat)) {
        addFiles(files, category);
      }
    }
  }
  return out;
}

/**
 * Parse compliance uploads on disk and persist expiry metadata for the attestation.
 */
export async function parseAndStoreComplianceDocumentExpiries(
  attestationId: string,
  documentUploads: Record<string, unknown> | null | undefined,
): Promise<ComplianceDocExpiryMap> {
  const items = collectComplianceFiles(documentUploads);
  const result: ComplianceDocExpiryMap = {};
  const dir = path.resolve(UPLOADS_DIR, attestationId);
  const baseResolved = path.resolve(UPLOADS_DIR);
  if (!dir.startsWith(baseResolved)) {
    return result;
  }

  const nowIso = new Date().toISOString();

  for (const { fileName, category } of items) {
    const safe = path.basename(fileName);
    const filePath = path.resolve(dir, safe);
    if (!filePath.startsWith(dir) || !fs.existsSync(filePath)) {
      result[safe] = {
        category,
        expiryAt: null,
        parsedAt: nowIso,
        error: "File not found on server",
      };
      continue;
    }
    const ext = path.extname(safe);
    try {
      const text = await extractTextFromFile(filePath, ext);
      if (!text || text.length < 20) {
        result[safe] = {
          category,
          expiryAt: null,
          parsedAt: nowIso,
          error: "Could not extract enough text from document",
        };
        continue;
      }
      const expiry = extractExpiryFromText(text);
      result[safe] = {
        category,
        expiryAt: expiry ? toDateOnlyLocal(expiry) : null,
        parsedAt: nowIso,
        ...(expiry ? {} : { error: "No expiry date pattern detected" }),
      };
    } catch (err) {
      result[safe] = {
        category,
        expiryAt: null,
        parsedAt: nowIso,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  try {
    await db
      .update(vendorSelfAttestations)
      .set({
        compliance_document_expiries: result as unknown as Record<string, unknown>,
        updated_at: new Date(),
      })
      .where(eq(vendorSelfAttestations.id, attestationId));
  } catch (e) {
    console.error("parseAndStoreComplianceDocumentExpiries DB update:", e);
  }

  return result;
}
