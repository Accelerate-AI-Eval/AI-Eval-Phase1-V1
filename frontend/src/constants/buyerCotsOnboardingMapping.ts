/**
 * Buyer COTS assessment fields that are Auto-populated from buyer onboarding.
 * Keys = buyer COTS form key; value = onboarding response field name (camelCase).
 * API may return camelCase or snake_case; we check both.
 */
/** Excel: "Auto-populated" = from onboarding; pre-filled but all dropdowns/inputs remain editable */
export const BUYER_COTS_AUTO_POPULATED_FROM_ONBOARDING: Record<
  string,
  string
> = {
  organizationName: "organizationName",
  industrySector: "sector",
  employeeCount: "employeeCount",
  operatingRegions: "operatingRegions",
  owningDepartment: "departmentOwner",
  techStack: "existingTechStack",
  dataGovernanceMaturity: "dataGovernanceMaturity",
  aiGovernanceBoard: "aiGovernanceMaturity",
  riskAppetite: "aiRiskAppetite",
};

/** Snake_case equivalents for API responses that return DB column names */
const ONBOARDING_SNAKE_KEYS: Record<string, string> = {
  organizationName: "organization_name",
  industrySector: "sector",
  employeeCount: "employee_count",
  operatingRegions: "operating_regions",
  owningDepartment: "department_owner",
  techStack: "existing_tech_stack",
  dataGovernanceMaturity: "data_governance_maturity",
  aiGovernanceBoard: "ai_governance_maturity",
  riskAppetite: "ai_risk_appetite",
};

/**
 * Form keys that store multiselect values as JSON array string
 * (onboarding may return array; industry sector is nested object flattened to array).
 */
const MULTISELECT_FORM_KEYS = ["operatingRegions", "techStack", "industrySector"];

/** Keys to pre-fill from onboarding (all auto-populated fields) */
const PRE_FILL_KEYS = Object.keys(BUYER_COTS_AUTO_POPULATED_FROM_ONBOARDING);

/** List of form keys that are read-only in the UI. Empty = all dropdowns/inputs accessible even when pre-filled from onboarding. */
export const BUYER_COTS_READONLY_KEYS: string[] = [];

function getValue(obj: Record<string, unknown>, formKey: string): unknown {
  const camel = BUYER_COTS_AUTO_POPULATED_FROM_ONBOARDING[formKey];
  const snake = ONBOARDING_SNAKE_KEYS[formKey];
  if (obj[camel] != null) return obj[camel];
  if (snake && obj[snake] != null) return obj[snake];
  return undefined;
}

function tryParseJson(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  const t = raw.trim();
  if (!t) return raw;
  if (!(t.startsWith("{") || t.startsWith("["))) return raw;
  try {
    return JSON.parse(t);
  } catch {
    return raw;
  }
}

/**
 * Buyer onboarding stores sector as:
 *   { public_sector: string[], private_sector: string[], non_profit_sector: string[] }
 * (or a JSON string of that shape). Flatten to the selected industry labels.
 */
export function flattenOnboardingSectorIndustries(raw: unknown): string[] {
  const parsed = tryParseJson(raw);
  if (Array.isArray(parsed)) {
    return parsed.map((x) => String(x).trim()).filter(Boolean);
  }
  if (parsed == null || typeof parsed !== "object") {
    if (typeof raw === "string" && raw.trim() && !raw.trim().startsWith("{")) {
      return raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return [];
  }
  const o = parsed as Record<string, unknown>;
  const buckets = [
    o.public_sector,
    o.private_sector,
    o.non_profit_sector,
    o.publicSector,
    o.privateSector,
    o.nonProfitSector,
  ];
  const out: string[] = [];
  for (const bucket of buckets) {
    if (!Array.isArray(bucket)) continue;
    for (const item of bucket) {
      const s = String(item ?? "").trim();
      if (s && !out.includes(s)) out.push(s);
    }
  }
  return out;
}

function normalizeToStringArray(raw: unknown): string[] {
  const parsed = tryParseJson(raw);
  if (Array.isArray(parsed)) {
    return parsed.map((x) => String(x).trim()).filter(Boolean);
  }
  if (typeof parsed === "string" && parsed.trim()) {
    return parsed
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

/**
 * Build form patch from buyer onboarding API response (data.buyer).
 * Handles jsonb/array fields by stringifying for display.
 * Supports both camelCase and snake_case keys from the API.
 */
export function mapOnboardingToAssessmentForm(buyer: Record<string, unknown> | null): Record<string, string> {
  if (!buyer || typeof buyer !== "object") return {};
  const out: Record<string, string> = {};
  for (const formKey of PRE_FILL_KEYS) {
    const raw = getValue(buyer, formKey);
    if (raw == null) continue;

    if (formKey === "industrySector") {
      const industries = flattenOnboardingSectorIndustries(raw);
      if (industries.length === 0) continue;
      out[formKey] = JSON.stringify(industries);
      continue;
    }

    if (MULTISELECT_FORM_KEYS.includes(formKey)) {
      const arr = normalizeToStringArray(raw);
      if (arr.length === 0) continue;
      out[formKey] = JSON.stringify(arr);
      continue;
    }

    const parsed = tryParseJson(raw);
    if (Array.isArray(parsed)) {
      out[formKey] = parsed.map((x) => String(x)).join(", ");
    } else if (parsed != null && typeof parsed === "object") {
      out[formKey] = JSON.stringify(parsed);
    } else {
      const s = String(raw).trim();
      if (s) out[formKey] = s;
    }
  }
  return out;
}
