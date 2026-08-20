import { logger } from "../../middlewares/logger.js";
import { getAiRiskApiKeyConfig } from "../admin/aiRiskApiKeyConfig.service.js";

/**
 * HTTP client for the Risk Intellect /risks/export service-to-service endpoint.
 *
 * Auth: the single platform AI Risk API key stored in AI-Q (Controls → AI Risk API Key).
 * Base URL: AI_RISK_INTELLECT_BASE_URL | RI_BASE_URL (server env).
 *
 * Export fields used by scoring:
 * - intent → type 2/3 intent multiplier
 * - likelihood, impact, severity → type 1 VTS product risk (L × I)
 *
 * Returns null on any failure so callers fall back to the static risk_mappings DB.
 */

export type RiRiskExportDto = {
  id: string;
  riskTitle: string;
  domain: string;
  qualityScore: number;
  description: string;
  attackVector: string;
  primaryRisk: string;
  /** Intentional / Unintentional — used for type 2/3 intent score after local risk match */
  intent: string | null;
  /** Likelihood 1–5 from Risk Intellect (VTS product risk). */
  likelihood: number | null;
  /** Impact 1–5 from Risk Intellect (VTS product risk). */
  impact: number | null;
  /** Severity 1–25 (often L×I) from Risk Intellect. */
  severity: number | null;
  sector: string | null;
  industry: string | null;
  sourceUrl: string;
  articleTitle: string;
  articleDate: string;
  catalogMatchId: string | null;
  catalogMatchTitle: string | null;
};

export type RiExportResult = {
  risks: RiRiskExportDto[];
  total: number;
  limit: number;
  minQuality: number;
  domains: string[] | null;
};

export type RiExportParams = {
  domains?: string[];
  minQuality?: number;
  sector?: string;
  limit?: number;
};

const TIMEOUT_MS = 2_000;
const MAX_RETRIES = 1;
const RETRY_DELAY_MS = 150;

export function getRiConfig(): { baseUrl: string; apiKey: string } {
  // Single platform key from AI-Q Controls (persisted to .env.local / process.env).
  const { baseUrl, apiKey } = getAiRiskApiKeyConfig();
  return { baseUrl, apiKey };
}

export function isRiskIntellectConfigured(): boolean {
  const { baseUrl, apiKey } = getRiConfig();
  return Boolean(baseUrl && apiKey);
}

export function buildExportUrl(baseUrl: string, params: RiExportParams): string {
  const url = new URL(`${baseUrl.replace(/\/$/, "")}/api/v1/risks/export`);
  if (params.domains && params.domains.length > 0) {
    url.searchParams.set("domains", params.domains.join(","));
  }
  if (params.minQuality !== undefined) {
    url.searchParams.set("minQuality", String(params.minQuality));
  }
  if (params.sector) {
    url.searchParams.set("sector", params.sector);
  }
  if (params.limit !== undefined) {
    url.searchParams.set("limit", String(params.limit));
  }
  return url.toString();
}

function firstPresent(r: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (key in r && r[key] != null && r[key] !== "") return r[key];
  }
  return undefined;
}

/** Clamp a Risk Intellect numeric score into [min, max]. Returns null if missing/invalid. */
export function parseRiBoundedScore(
  raw: unknown,
  min: number,
  max: number,
): number | null {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "string" ? Number(raw.trim()) : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(max, Math.max(min, n));
}

function normalizeRiRisk(raw: unknown): RiRiskExportDto | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const intentRaw = r["intent"] ?? r["Intent"];
  const catalogMatchIdRaw = r["catalogMatchId"] ?? r["catalog_match_id"];
  const catalogMatchTitleRaw = r["catalogMatchTitle"] ?? r["catalog_match_title"];
  const quality = Number(r["qualityScore"] ?? r["quality_score"] ?? 0);
  const likelihood = parseRiBoundedScore(
    firstPresent(r, [
      "likelihood",
      "likelihoodScore",
      "likelihood_score",
      "likelihoodRating",
      "likelihood_rating",
    ]),
    1,
    5,
  );
  const impact = parseRiBoundedScore(
    firstPresent(r, [
      "impact",
      "impactScore",
      "impact_score",
      "impactRating",
      "impact_rating",
    ]),
    1,
    5,
  );
  const severityRaw = parseRiBoundedScore(
    firstPresent(r, [
      "severity",
      "severityScore",
      "severity_score",
      "severityRating",
      "severity_rating",
    ]),
    1,
    25,
  );
  const severity =
    severityRaw ??
    (likelihood != null && impact != null ? likelihood * impact : null);
  return {
    id: String(r["id"] ?? ""),
    riskTitle: String(r["riskTitle"] ?? r["risk_title"] ?? ""),
    domain: String(r["domain"] ?? r["domains"] ?? ""),
    qualityScore: Number.isFinite(quality) ? quality : 0,
    description: String(r["description"] ?? ""),
    attackVector: String(r["attackVector"] ?? r["attack_vector"] ?? ""),
    primaryRisk: String(r["primaryRisk"] ?? r["primary_risk"] ?? ""),
    intent:
      intentRaw == null || String(intentRaw).trim() === ""
        ? null
        : String(intentRaw).trim(),
    likelihood,
    impact,
    severity,
    sector: r["sector"] == null ? null : String(r["sector"]),
    industry: r["industry"] == null ? null : String(r["industry"]),
    sourceUrl: String(r["sourceUrl"] ?? r["source_url"] ?? ""),
    articleTitle: String(r["articleTitle"] ?? r["article_title"] ?? ""),
    articleDate: String(r["articleDate"] ?? r["article_date"] ?? ""),
    catalogMatchId:
      catalogMatchIdRaw == null || String(catalogMatchIdRaw).trim() === ""
        ? null
        : String(catalogMatchIdRaw).trim(),
    catalogMatchTitle:
      catalogMatchTitleRaw == null || String(catalogMatchTitleRaw).trim() === ""
        ? null
        : String(catalogMatchTitleRaw).trim(),
  };
}

function isRiExportResult(data: unknown): data is RiExportResult {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  return Array.isArray(d["risks"]) && typeof d["total"] === "number";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  url: string,
  headers: Record<string, string>,
): Promise<Response> {
  let lastError: Error = new Error("Fetch failed");
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        method: "GET",
        headers,
        signal: controller.signal,
      });
      clearTimeout(timer);
      return response;
    } catch (err) {
      clearTimeout(timer);
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS * (attempt + 1));
      }
    }
  }
  throw lastError;
}

/**
 * Fetches approved, quality-filtered risk incidents from Risk Intellect.
 * Returns null when unconfigured, unavailable, or response is invalid.
 */
export async function fetchRisksFromRI(
  params: RiExportParams = {},
): Promise<RiExportResult | null> {
  const { baseUrl, apiKey } = getRiConfig();
  if (!baseUrl || !apiKey) {
    logger.debug("ri.fetch.skipped", {
      service: "risk-intellect-client",
      event: "ri.fetch.skipped",
      reason: "not-configured",
    });
    return null;
  }

  let url: string;
  try {
    url = buildExportUrl(baseUrl, params);
  } catch {
    logger.warn("ri.fetch.failed", {
      service: "risk-intellect-client",
      event: "ri.fetch.failed",
      reason: "invalid-base-url",
      durationMs: 0,
    });
    return null;
  }
  const startMs = Date.now();

  let response: Response;
  try {
    response = await fetchWithRetry(url, { "X-API-Key": apiKey });
  } catch {
    logger.warn("ri.fetch.failed", {
      service: "risk-intellect-client",
      event: "ri.fetch.failed",
      reason: "network-error",
      durationMs: Date.now() - startMs,
    });
    return null;
  }

  if (!response.ok) {
    logger.warn("ri.fetch.failed", {
      service: "risk-intellect-client",
      event: "ri.fetch.failed",
      reason: "http-error",
      status: response.status,
      durationMs: Date.now() - startMs,
    });
    return null;
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    logger.warn("ri.fetch.failed", {
      service: "risk-intellect-client",
      event: "ri.fetch.failed",
      reason: "parse-error",
      durationMs: Date.now() - startMs,
    });
    return null;
  }

  if (!isRiExportResult(data)) {
    logger.warn("ri.fetch.failed", {
      service: "risk-intellect-client",
      event: "ri.fetch.failed",
      reason: "invalid-shape",
      durationMs: Date.now() - startMs,
    });
    return null;
  }

  const normalizedRisks = data.risks
    .map((r) => normalizeRiRisk(r))
    .filter((r): r is RiRiskExportDto => r != null);

  const normalized: RiExportResult = {
    risks: normalizedRisks,
    total: typeof data.total === "number" ? data.total : normalizedRisks.length,
    limit: typeof data.limit === "number" ? data.limit : params.limit ?? normalizedRisks.length,
    minQuality: typeof data.minQuality === "number" ? data.minQuality : 0,
    domains: Array.isArray(data.domains) ? (data.domains as string[]) : null,
  };

  logger.info("ri.fetch.success", {
    service: "risk-intellect-client",
    event: "ri.fetch.success",
    count: normalized.risks.length,
    hasSector: !!params.sector,
    durationMs: Date.now() - startMs,
  });
  console.log("[type-01 VTS] AI Risk Intellect export (L/I per risk)", {
    count: normalized.risks.length,
    sector: params.sector ?? null,
    scores: normalized.risks.map((r) => ({
      catalogMatchId: r.catalogMatchId,
      riskTitle: r.riskTitle,
      likelihood: r.likelihood,
      impact: r.impact,
      severity: r.severity,
    })),
  });
  return normalized;
}
