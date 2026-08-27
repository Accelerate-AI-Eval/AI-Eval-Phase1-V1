import { logger } from "../../middlewares/logger.js";
import { getAiRiskApiKeyConfig } from "../admin/aiRiskApiKeyConfig.service.js";

/**
 * HTTP client for Risk Intellect (hosted AI Risk Intelligence).
 *
 * Hosted JSON list: GET /api/v1/risks  (X-API-Key from Controls).
 * /api/v1/risks/export is tried as a fallback; the production host 404s that path
 * after auth because it is not the public list route.
 *
 * Fields used by scoring:
 * - intent → type 2/3 intent multiplier
 * - riskScoring.likelihood / impact / severityScore → type 1 VTS product risk (L × I)
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

const TIMEOUT_MS = 15_000;
const MAX_RETRIES = 1;
const RETRY_DELAY_MS = 150;
const MAX_SECTOR_QUERY_LEN = 80;

/** RI `sector` must be a short name (e.g. Healthcare). JSON blobs match nothing. */
export function sanitizeRiSectorParam(raw: string | undefined): string | undefined {
  const s = (raw ?? "").trim();
  if (!s) return undefined;
  if (s.startsWith("{") || s.startsWith("[")) return undefined;
  if (s.length > MAX_SECTOR_QUERY_LEN) return undefined;
  return s;
}

export function getRiConfig(): { baseUrl: string; apiKey: string } {
  // Single platform key from AI-Q Controls (persisted to .env.local / process.env).
  const { baseUrl, apiKey } = getAiRiskApiKeyConfig();
  return { baseUrl, apiKey };
}

export function isRiskIntellectConfigured(): boolean {
  const { baseUrl, apiKey } = getRiConfig();
  return Boolean(baseUrl && apiKey);
}

const RI_RISK_PATHS = ["/api/v1/risks", "/api/v1/risks/export"] as const;

export function buildExportUrl(
  baseUrl: string,
  params: RiExportParams,
  path: string = RI_RISK_PATHS[0],
): string {
  const url = new URL(`${baseUrl.replace(/\/$/, "")}${path}`);
  if (params.domains && params.domains.length > 0) {
    url.searchParams.set("domains", params.domains.join(","));
  }
  if (params.minQuality !== undefined) {
    url.searchParams.set("minQuality", String(params.minQuality));
  }
  const sector = sanitizeRiSectorParam(params.sector);
  if (sector) {
    url.searchParams.set("sector", sector);
  }
  if (params.limit !== undefined) {
    url.searchParams.set("limit", String(params.limit));
  }
  return url.toString();
}

function riAuthHeaders(apiKey: string): Record<string, string> {
  // Hosted RI issues `ari_…` keys for the X-API-Key header. Do not send them as
  // Authorization Bearer — that JWT middleware 404s a valid service key.
  return {
    Accept: "application/json",
    "X-API-Key": apiKey,
  };
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

function nestedRecord(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

function firstCatalogMatch(r: Record<string, unknown>): Record<string, unknown> | null {
  const analysis = nestedRecord(r["riskAnalysis"]);
  const matches = analysis?.["catalogMatches"];
  if (!Array.isArray(matches) || matches.length === 0) return null;
  return nestedRecord(matches[0]);
}

function normalizeRiRisk(raw: unknown): RiRiskExportDto | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const scoring = nestedRecord(r["riskScoring"]) ?? {};
  const catalog = firstCatalogMatch(r);
  const intentRaw = r["intent"] ?? r["Intent"] ?? scoring["intent"];
  const catalogMatchIdRaw =
    r["catalogMatchId"] ??
    r["catalog_match_id"] ??
    catalog?.["id"] ??
    catalog?.["riskId"] ??
    catalog?.["risk_id"] ??
    catalog?.["catalogMatchId"];
  const catalogMatchTitleRaw =
    r["catalogMatchTitle"] ??
    r["catalog_match_title"] ??
    catalog?.["title"] ??
    catalog?.["riskTitle"];
  const quality = Number(r["qualityScore"] ?? r["quality_score"] ?? 0);
  const likelihood = parseRiBoundedScore(
    firstPresent({ ...r, ...scoring }, [
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
    firstPresent({ ...r, ...scoring }, [
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
    firstPresent({ ...r, ...scoring }, [
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
    id: String(r["id"] ?? r["displayId"] ?? ""),
    riskTitle: String(r["riskTitle"] ?? r["risk_title"] ?? r["title"] ?? ""),
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
    sourceUrl: String(r["sourceUrl"] ?? r["source_url"] ?? r["articleUrl"] ?? ""),
    articleTitle: String(r["articleTitle"] ?? r["article_title"] ?? ""),
    articleDate: String(r["articleDate"] ?? r["article_date"] ?? r["ingestedAt"] ?? ""),
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

function extractRisksArray(data: unknown): unknown[] | null {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (Array.isArray(d["risks"])) return d["risks"];
  if (Array.isArray(d["items"])) return d["items"];
  if (Array.isArray(d["data"])) return d["data"];
  return null;
}

async function readErrorSnippet(response: Response): Promise<string> {
  try {
    const text = (await response.text()).replace(/\s+/g, " ").trim();
    return text.slice(0, 300);
  } catch {
    return "";
  }
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

  const headers = riAuthHeaders(apiKey);
  const startMs = Date.now();
  let lastUrl = "";
  let lastStatus: number | undefined;
  let lastBody = "";

  for (const path of RI_RISK_PATHS) {
    const queryParams: RiExportParams =
      path === "/api/v1/risks" ? {} : params;
    let url: string;
    try {
      url = buildExportUrl(baseUrl, queryParams, path);
    } catch {
      continue;
    }
    lastUrl = url;

    let response: Response;
    try {
      response = await fetchWithRetry(url, headers);
    } catch {
      const durationMs = Date.now() - startMs;
      logger.warn("ri.fetch.failed", {
        service: "risk-intellect-client",
        event: "ri.fetch.failed",
        reason: "network-error",
        durationMs,
      });
      console.warn("[RI] fetch failed", { reason: "network-error", durationMs, url });
      continue;
    }

    if (!response.ok) {
      lastStatus = response.status;
      lastBody = await readErrorSnippet(response);
      logger.warn("ri.fetch.failed", {
        service: "risk-intellect-client",
        event: "ri.fetch.failed",
        reason: "http-error",
        status: response.status,
        durationMs: Date.now() - startMs,
      });
      console.warn("[RI] fetch failed", {
        reason: "http-error",
        status: response.status,
        durationMs: Date.now() - startMs,
        url,
        body: lastBody || undefined,
      });
      if (response.status === 401 || response.status === 403) {
        break;
      }
      continue;
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      console.warn("[RI] fetch failed", {
        reason: "parse-error",
        durationMs: Date.now() - startMs,
        url,
      });
      continue;
    }

    const rawRisks = extractRisksArray(data);
    if (!rawRisks) {
      console.warn("[RI] fetch failed", {
        reason: "invalid-shape",
        durationMs: Date.now() - startMs,
        url,
      });
      continue;
    }

    const payload = data as Record<string, unknown>;
    const allRisks = rawRisks
      .map((r) => normalizeRiRisk(r))
      .filter((r): r is RiRiskExportDto => r != null);
    const normalizedRisks =
      typeof params.limit === "number" && params.limit > 0
        ? allRisks.slice(0, params.limit)
        : allRisks;

    const normalized: RiExportResult = {
      risks: normalizedRisks,
      total: typeof payload.total === "number" ? payload.total : normalizedRisks.length,
      limit:
        typeof payload.limit === "number"
          ? payload.limit
          : params.limit ?? normalizedRisks.length,
      minQuality: typeof payload.minQuality === "number" ? payload.minQuality : 0,
      domains: Array.isArray(payload.domains) ? (payload.domains as string[]) : null,
    };

    logger.info("ri.fetch.success", {
      service: "risk-intellect-client",
      event: "ri.fetch.success",
      count: normalized.risks.length,
      path,
      hasSector: !!params.sector,
      durationMs: Date.now() - startMs,
    });
    console.log("[type-01 VTS] AI Risk Intellect export (L/I per risk)", {
      count: normalized.risks.length,
      path,
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

  console.warn("[RI] fetch failed", {
    reason: "all-paths-exhausted",
    status: lastStatus,
    durationMs: Date.now() - startMs,
    url: lastUrl,
    body: lastBody || undefined,
  });
  return null;
}
