/**
 * IRS Score Trace — internal operator explainability only.
 *
 * Mirrors the logic of calculateOrgReadinessGap() and calculateIntegrationRisk()
 * in buyerImplementationRiskScore.ts WITHOUT modifying those functions.
 *
 * Each factor adjustment is emitted as a ScoreTraceComponent whose `contribution`
 * is the effect on the FINAL IRS score (not the sub-risk intermediate).
 *
 * Conversion: a +D increase in OrgReadinessGap sub-risk → -(D × 0.35) on IRS.
 *             a +D increase in IntegrationRisk sub-risk → -(D × 0.30) on IRS.
 *
 * INTERNAL USE ONLY — never return this data to buyer or vendor users.
 */

import { SCORING_VERSION } from "../lib/scoringVersion.js";
import type { ScoreTrace, ScoreTraceComponent } from "../types/scoreTrace.js";
import { irsFinalScoreFromParts } from "./buyerImplementationRiskScore.js";

// ── Weight constants (mirrors buyerImplementationRiskScore.ts, not re-exported) ──
const W_VENDOR = 0.35;
const W_ORG    = 0.35;
const W_INT    = 0.30;

// ── Helpers (exact copies of private helpers in buyerImplementationRiskScore.ts) ──

function norm(v: unknown): string {
  return String(v ?? "").trim().toLowerCase();
}

function boolYes(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  const s = norm(v);
  return s.startsWith("yes") || s === "true" || s === "available" || s === "exists" || s === "defined";
}

function parseList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (typeof v === "string") {
    const t = v.trim();
    if (!t) return [];
    try {
      const parsed = JSON.parse(t);
      if (Array.isArray(parsed)) return parsed.map((x) => String(x).trim()).filter(Boolean);
    } catch {
      // no-op
    }
    return t.split(/,|;|\r?\n/).map((x) => x.trim()).filter(Boolean);
  }
  return [];
}

function isHighStakes(criticality: string): boolean {
  return (
    criticality.includes("life or death") ||
    criticality.includes("major financial") ||
    criticality.includes("high") ||
    criticality.includes("critical")
  );
}

function isLowOrMediumStakes(criticality: string): boolean {
  return (
    criticality.includes("low impact") ||
    criticality.includes("minimal") ||
    criticality.includes("moderate impact") ||
    criticality.includes("medium") ||
    criticality.includes("low")
  );
}

function isAggressiveAppetite(appetite: string): boolean {
  return (
    appetite.includes("aggressive") ||
    appetite.includes("very high") ||
    appetite.startsWith("high")
  );
}

function isConservativeAppetite(appetite: string): boolean {
  return (
    appetite.includes("conservative") ||
    appetite.includes("very low") ||
    appetite.startsWith("low")
  );
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function toIsoTimestamp(value: string | Date | null | undefined): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value === "string" && value.trim()) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return null;
}

function component(
  label: string,
  category: string,
  contributionRaw: number,
  reason: string,
  sourceType: ScoreTraceComponent["sourceType"],
  sourceLabel: string,
): ScoreTraceComponent {
  const contribution = round2(contributionRaw);
  return {
    label,
    category,
    contribution,
    direction: contribution > 0 ? "positive" : contribution < 0 ? "negative" : "neutral",
    reason,
    sourceType,
    sourceLabel,
    internalOnly: true,
  };
}

// ── Org Readiness Gap trace ────────────────────────────────────────────────────

function traceOrgReadinessGap(
  buyerPayload: Record<string, unknown>,
): { components: ScoreTraceComponent[]; computedRisk: number; warnings: string[] } {
  const components: ScoreTraceComponent[] = [];
  const warnings: string[] = [];
  let risk = 35;

  // Base
  components.push(
    component(
      "Organizational Readiness — base risk",
      "OrgReadiness",
      -(35 * W_ORG),
      "All buyer assessments start with a base organizational readiness gap of 35.",
      "system_default",
      "scoring engine default",
    ),
  );

  // Digital maturity (Level 1–5 buyer COTS options + legacy labels)
  const digital = norm(buyerPayload.digitalMaturityLevel);
  if (
    digital.includes("level 5") ||
    digital.includes("level 4") ||
    digital.includes("high") ||
    digital.includes("advanced")
  ) {
    risk -= 10;
    components.push(
      component(
        "Digital Maturity: High/Advanced (Level 4–5)",
        "OrgReadiness",
        +(10 * W_ORG),
        `Digital maturity reported as "${buyerPayload.digitalMaturityLevel}" — reduces organizational gap risk by 10.`,
        "assessment_answer",
        "field: digitalMaturityLevel",
      ),
    );
  } else if (digital.includes("level 3") || digital.includes("medium")) {
    risk -= 4;
    components.push(
      component(
        "Digital Maturity: Medium (Level 3)",
        "OrgReadiness",
        +(4 * W_ORG),
        `Digital maturity reported as "${buyerPayload.digitalMaturityLevel}" — reduces organizational gap risk by 4.`,
        "assessment_answer",
        "field: digitalMaturityLevel",
      ),
    );
  } else if (
    digital.includes("level 1") ||
    digital.includes("level 2") ||
    digital.includes("low") ||
    digital.includes("ad-hoc")
  ) {
    risk += 10;
    components.push(
      component(
        "Digital Maturity: Low (Level 1–2)",
        "OrgReadiness",
        -(10 * W_ORG),
        `Digital maturity reported as "${buyerPayload.digitalMaturityLevel}" — increases organizational gap risk by 10.`,
        "assessment_answer",
        "field: digitalMaturityLevel",
      ),
    );
  }

  // Data governance
  const governance = norm(buyerPayload.dataGovernanceMaturity);
  if (
    governance.includes("optimized") ||
    governance.includes("managed") ||
    governance.includes("mature")
  ) {
    risk -= 8;
    components.push(
      component(
        "Data Governance: Optimized/Managed/Mature",
        "OrgReadiness",
        +(8 * W_ORG),
        `Data governance reported as "${buyerPayload.dataGovernanceMaturity}" — reduces organizational gap risk by 8.`,
        "assessment_answer",
        "field: dataGovernanceMaturity",
      ),
    );
  } else if (governance.includes("basic") || governance.includes("developing")) {
    risk += 4;
    components.push(
      component(
        "Data Governance: Basic/Developing",
        "OrgReadiness",
        -(4 * W_ORG),
        `Data governance reported as "${buyerPayload.dataGovernanceMaturity}" — increases organizational gap risk by 4.`,
        "assessment_answer",
        "field: dataGovernanceMaturity",
      ),
    );
  } else if (
    governance.includes("ad-hoc") ||
    governance.includes("low") ||
    governance.includes("initial") ||
    governance.startsWith("none")
  ) {
    risk += 10;
    components.push(
      component(
        "Data Governance: None/Initial/Ad-hoc",
        "OrgReadiness",
        -(10 * W_ORG),
        `Data governance reported as "${buyerPayload.dataGovernanceMaturity}" — increases organizational gap risk by 10.`,
        "assessment_answer",
        "field: dataGovernanceMaturity",
      ),
    );
  }

  // AI governance board
  if (!boolYes(buyerPayload.aiGovernanceBoard)) {
    risk += 8;
    components.push(
      component(
        "No AI Governance Board",
        "OrgReadiness",
        -(8 * W_ORG),
        `AI governance board field value "${buyerPayload.aiGovernanceBoard ?? "(empty)"}" was not recognized as confirmed — increases gap risk by 8.`,
        "assessment_answer",
        "field: aiGovernanceBoard",
      ),
    );
  } else {
    components.push(
      component(
        "AI Governance Board Confirmed",
        "OrgReadiness",
        0,
        `AI governance board confirmed — no penalty applied.`,
        "assessment_answer",
        "field: aiGovernanceBoard",
      ),
    );
  }

  // AI ethics policy
  if (!boolYes(buyerPayload.aiEthicsPolicy)) {
    risk += 8;
    components.push(
      component(
        "No AI Ethics Policy",
        "OrgReadiness",
        -(8 * W_ORG),
        `AI ethics policy field value "${buyerPayload.aiEthicsPolicy ?? "(empty)"}" was not recognized as confirmed — increases gap risk by 8.`,
        "assessment_answer",
        "field: aiEthicsPolicy",
      ),
    );
  } else {
    components.push(
      component(
        "AI Ethics Policy Confirmed",
        "OrgReadiness",
        0,
        `AI ethics policy confirmed — no penalty applied.`,
        "assessment_answer",
        "field: aiEthicsPolicy",
      ),
    );
  }

  // Team composition
  const team = parseList(buyerPayload.implementationTeamComposition).filter(
    (t) => !norm(t).includes("no team"),
  );
  if (team.length >= 4) {
    risk -= 6;
    components.push(
      component(
        `Implementation Team: ${team.length} roles`,
        "OrgReadiness",
        +(6 * W_ORG),
        `Team composition has ${team.length} roles (4+) — reduces organizational gap risk by 6.`,
        "assessment_answer",
        "field: implementationTeamComposition",
      ),
    );
  } else if (team.length <= 1) {
    risk += 8;
    components.push(
      component(
        `Implementation Team: ${team.length === 0 ? "not specified" : `${team.length} role`}`,
        "OrgReadiness",
        -(8 * W_ORG),
        `Team composition has ${team.length} role(s) (≤1) — increases organizational gap risk by 8.`,
        "assessment_answer",
        "field: implementationTeamComposition",
      ),
    );
  }

  // Criticality × Risk appetite (aligned to Buyer COTS option labels)
  const appetite = norm(buyerPayload.riskAppetite);
  const criticality = norm(buyerPayload.criticality);
  if (isHighStakes(criticality) && isAggressiveAppetite(appetite)) {
    risk += 8;
    components.push(
      component(
        "High Criticality + Aggressive Risk Appetite",
        "OrgReadiness",
        -(8 * W_ORG),
        `Criticality "${buyerPayload.criticality}" and risk appetite "${buyerPayload.riskAppetite}" — high-stakes combination increases gap risk by 8.`,
        "assessment_answer",
        "fields: criticality, riskAppetite",
      ),
    );
  } else if (isLowOrMediumStakes(criticality) && isConservativeAppetite(appetite)) {
    risk -= 2;
    components.push(
      component(
        "Low/Medium Criticality + Conservative Appetite",
        "OrgReadiness",
        +(2 * W_ORG),
        `Criticality "${buyerPayload.criticality}" and risk appetite "${buyerPayload.riskAppetite}" — low-risk combination reduces gap risk by 2.`,
        "assessment_answer",
        "fields: criticality, riskAppetite",
      ),
    );
  }

  // Clamping
  const computedRisk = Math.max(0, Math.min(100, risk));
  if (computedRisk !== risk) {
    warnings.push(
      `Organizational readiness gap was clamped from ${risk} to ${computedRisk} — trace component sum may not exactly reconcile.`,
    );
  }

  return { components, computedRisk, warnings };
}

// ── Integration Risk trace ─────────────────────────────────────────────────────

function traceIntegrationRisk(
  buyerPayload: Record<string, unknown>,
): { components: ScoreTraceComponent[]; computedRisk: number; warnings: string[] } {
  const components: ScoreTraceComponent[] = [];
  const warnings: string[] = [];
  let risk = 25;

  // Base
  components.push(
    component(
      "Integration Risk — base",
      "Integration",
      -(25 * W_INT),
      "All buyer assessments start with a base integration risk of 25.",
      "system_default",
      "scoring engine default",
    ),
  );

  // Integration systems
  const systems = parseList(buyerPayload.integrationSystems).filter((s) => {
    const n = norm(s);
    return !n.includes("no integration") && n !== "none";
  });
  const systemsDelta = Math.min(30, systems.length * 6);
  if (systems.length > 0) {
    risk += systemsDelta;
    components.push(
      component(
        `${systems.length} Integration System${systems.length > 1 ? "s" : ""}`,
        "Integration",
        -(systemsDelta * W_INT),
        `${systems.length} integration system(s) detected: ${systems.slice(0, 5).join(", ")}${systems.length > 5 ? " …" : ""} — adds ${systemsDelta} to integration risk (capped at +30).`,
        "assessment_answer",
        "field: integrationSystems",
      ),
    );
  }

  // Currently using product? (stored as requirementGaps; Yes/No)
  const currentlyUsing = norm(buyerPayload.requirementGaps);
  if (currentlyUsing.startsWith("no")) {
    risk += 12;
    components.push(
      component(
        "Not Currently Using Product",
        "Integration",
        -(12 * W_INT),
        "Buyer is not currently using the product — adds 12 to integration risk.",
        "assessment_answer",
        "field: requirementGaps",
      ),
    );
  }

  // Rollback capability (aligned to Buyer COTS Instant/Rapid/Moderate/Limited/None options)
  const rollback = norm(buyerPayload.rollbackCapability);
  if (rollback.startsWith("none") || rollback.includes("no rollback") || rollback === "no") {
    risk += 12;
    components.push(
      component(
        `Rollback Capability: ${buyerPayload.rollbackCapability}`,
        "Integration",
        -(12 * W_INT),
        `Rollback capability "${buyerPayload.rollbackCapability}" indicates no rollback — adds 12 to integration risk.`,
        "assessment_answer",
        "field: rollbackCapability",
      ),
    );
  } else if (
    rollback.includes("manual") ||
    rollback.startsWith("moderate") ||
    rollback.startsWith("limited")
  ) {
    risk += 6;
    components.push(
      component(
        `Rollback Capability: ${buyerPayload.rollbackCapability}`,
        "Integration",
        -(6 * W_INT),
        `Rollback capability "${buyerPayload.rollbackCapability}" is manual/moderate/limited — adds 6 to integration risk.`,
        "assessment_answer",
        "field: rollbackCapability",
      ),
    );
  } else {
    risk -= 3;
    components.push(
      component(
        rollback.length > 0
          ? `Rollback Capability: ${buyerPayload.rollbackCapability}`
          : "Rollback Capability: not specified (automated/instant assumed)",
        "Integration",
        +(3 * W_INT),
        rollback.length > 0
          ? `Rollback capability "${buyerPayload.rollbackCapability}" appears automated/instant — reduces integration risk by 3.`
          : `Rollback capability was not specified; scoring engine assumes automated/instant and reduces integration risk by 3.`,
        "assessment_answer",
        "field: rollbackCapability",
      ),
    );
  }

  // Monitoring
  if (!boolYes(buyerPayload.monitoringDataAvailable)) {
    risk += 6;
    components.push(
      component(
        "Monitoring Data Not Available",
        "Integration",
        -(6 * W_INT),
        `Monitoring data field "${buyerPayload.monitoringDataAvailable ?? "(empty)"}" was not recognized as available — adds 6 to integration risk.`,
        "assessment_answer",
        "field: monitoringDataAvailable",
      ),
    );
  } else {
    components.push(
      component(
        "Monitoring Data Available",
        "Integration",
        0,
        "Monitoring data confirmed available — no penalty applied.",
        "assessment_answer",
        "field: monitoringDataAvailable",
      ),
    );
  }

  // Audit logs
  if (!boolYes(buyerPayload.auditLogsAvailable)) {
    risk += 6;
    components.push(
      component(
        "Audit Logs Not Available",
        "Integration",
        -(6 * W_INT),
        `Audit logs field "${buyerPayload.auditLogsAvailable ?? "(empty)"}" was not recognized as available — adds 6 to integration risk.`,
        "assessment_answer",
        "field: auditLogsAvailable",
      ),
    );
  } else {
    components.push(
      component(
        "Audit Logs Available",
        "Integration",
        0,
        "Audit logs confirmed available — no penalty applied.",
        "assessment_answer",
        "field: auditLogsAvailable",
      ),
    );
  }

  // Testing results
  if (!boolYes(buyerPayload.testingResultsAvailable)) {
    risk += 6;
    components.push(
      component(
        "Testing Results Not Available",
        "Integration",
        -(6 * W_INT),
        `Testing results field "${buyerPayload.testingResultsAvailable ?? "(empty)"}" was not recognized as available — adds 6 to integration risk.`,
        "assessment_answer",
        "field: testingResultsAvailable",
      ),
    );
  } else {
    components.push(
      component(
        "Testing Results Available",
        "Integration",
        0,
        "Testing results confirmed available — no penalty applied.",
        "assessment_answer",
        "field: testingResultsAvailable",
      ),
    );
  }

  const computedRisk = Math.max(0, Math.min(100, risk));
  if (computedRisk !== risk) {
    warnings.push(
      `Integration risk was clamped from ${risk} to ${computedRisk} — trace component sum may not exactly reconcile.`,
    );
  }

  return { components, computedRisk, warnings };
}

// ── Public entry point ─────────────────────────────────────────────────────────

export type IrsTraceInput = {
  /** Buyer payload reconstructed from DB columns (camelCase keys). */
  buyerPayload: Record<string, unknown>;
  /** Stored implementationRiskBreakdown from vendor_risk_assessment_report. */
  storedBreakdown: {
    vendorRisk: number;
    organizationalReadinessGap: number;
    integrationRisk: number;
    vendorTrustScore: number;
    /** AI Risk Intellect intent multiplier when present (default 1.0). */
    intentMultiplier?: number;
  };
  /** Stored final IRS from vendor_risk_assessment_report.implementationRiskScore. */
  storedScore: number;
  /** Whether a vendor attestation was linked when the report was generated. */
  usedAttestation: boolean;
  vendorName: string;
  productName: string;
  /** When the stored IRS was calculated (report generatedAt / irsRescoredAt / row timestamps). */
  generatedAt?: string | Date | null;
};

export function buildIrsScoreTrace(input: IrsTraceInput): ScoreTrace {
  const { buyerPayload, storedBreakdown, storedScore, usedAttestation, vendorName, productName } = input;
  const warnings: string[] = [];
  const missingEvidence: string[] = [];

  // ── Vendor Risk component ────────────────────────────────────────────────────
  const vtScore = storedBreakdown.vendorTrustScore;
  const vRisk = storedBreakdown.vendorRisk;
  const vendorComponents: ScoreTraceComponent[] = [];

  if (!usedAttestation) {
    warnings.push(
      `Vendor Trust Score defaulted to ${vtScore} — no linked attestation found for ${vendorName} / ${productName}. Actual risk may differ significantly.`,
    );
    vendorComponents.push(
      component(
        `Vendor Trust Score: ${vtScore} (default — no attestation)`,
        "VendorRisk",
        -(vRisk * W_VENDOR),
        `No vendor attestation was linked at the time of scoring. VTS defaulted to ${vtScore}; vendor risk = ${vRisk}. Contribution: −(${vRisk} × 0.35) = ${round2(-(vRisk * W_VENDOR))}.`,
        "system_default",
        `vendor: ${vendorName} / product: ${productName}`,
      ),
    );
    missingEvidence.push(
      `Vendor attestation not linked — linking an attestation could significantly change the score.`,
    );
  } else {
    vendorComponents.push(
      component(
        `Vendor Trust Score: ${vtScore}`,
        "VendorRisk",
        -(vRisk * W_VENDOR),
        `VTS = ${vtScore}; vendor risk = 100 − ${vtScore} = ${vRisk}. Contribution: −(${vRisk} × 0.35) = ${round2(-(vRisk * W_VENDOR))}.`,
        "vendor_attestation",
        `vendor: ${vendorName} / product: ${productName}`,
      ),
    );
  }

  // ── Org Readiness Gap trace ──────────────────────────────────────────────────
  const orgTrace = traceOrgReadinessGap(buyerPayload);
  warnings.push(...orgTrace.warnings);

  // ── Integration Risk trace ────────────────────────────────────────────────────
  const intTrace = traceIntegrationRisk(buyerPayload);
  warnings.push(...intTrace.warnings);

  // ── Missing evidence hints ────────────────────────────────────────────────────
  if (!boolYes(buyerPayload.aiGovernanceBoard)) {
    missingEvidence.push(
      "AI Governance Board not confirmed — confirming it would reduce org readiness gap by 8 points (+2.8 IRS).",
    );
  }
  if (!boolYes(buyerPayload.aiEthicsPolicy)) {
    missingEvidence.push(
      "AI Ethics Policy not confirmed — confirming it would reduce org readiness gap by 8 points (+2.8 IRS).",
    );
  }
  if (!boolYes(buyerPayload.auditLogsAvailable)) {
    missingEvidence.push(
      "Audit logs not confirmed — confirming would reduce integration risk by 6 points (+1.8 IRS).",
    );
  }
  if (!boolYes(buyerPayload.monitoringDataAvailable)) {
    missingEvidence.push(
      "Monitoring data not confirmed — confirming would reduce integration risk by 6 points (+1.8 IRS).",
    );
  }
  if (!boolYes(buyerPayload.testingResultsAvailable)) {
    missingEvidence.push(
      "Testing results not confirmed — confirming would reduce integration risk by 6 points (+1.8 IRS).",
    );
  }

  // ── Reconciliation check ──────────────────────────────────────────────────────
  const recomputedOrg = orgTrace.computedRisk;
  const recomputedInt = intTrace.computedRisk;
  const storedOrg = storedBreakdown.organizationalReadinessGap;
  const storedInt = storedBreakdown.integrationRisk;

  if (Math.abs(recomputedOrg - storedOrg) > 1) {
    warnings.push(
      `Org readiness gap reconciliation mismatch: trace computed ${recomputedOrg}, stored value is ${storedOrg}. ` +
        `Usually means this assessment was scored before irs-1.1 (form labels / Yes-* handling). ` +
        `Re-open Score Trace to auto-refresh stored IRS, or resubmit the assessment.`,
    );
  }
  if (Math.abs(recomputedInt - storedInt) > 1) {
    warnings.push(
      `Integration risk reconciliation mismatch: trace computed ${recomputedInt}, stored value is ${storedInt}. ` +
        `Same cause — stored breakdown is from an older scoring pass; refresh Score Trace or resubmit.`,
    );
  }

  // Canonical readiness score from stored breakdown (same helper as Python / buyer UI).
  const intentMultiplier =
    Number.isFinite(Number(storedBreakdown.intentMultiplier)) &&
    Number(storedBreakdown.intentMultiplier) > 0
      ? Number(storedBreakdown.intentMultiplier)
      : 1.0;
  const { score: canonicalIrs } = irsFinalScoreFromParts(
    vRisk,
    storedOrg,
    storedInt,
    intentMultiplier,
  );
  if (Math.abs(canonicalIrs - storedScore) >= 1) {
    warnings.push(
      `Stored score is ${storedScore}; canonical formula from breakdown is ${canonicalIrs}. ` +
        `Explainability headline uses the stored score so it matches the assessment card.`,
    );
  }

  const allComponents: ScoreTraceComponent[] = [
    ...vendorComponents,
    ...orgTrace.components,
    ...intTrace.components,
  ];

  return {
    scoreType: "buyer_implementation_risk",
    finalScore: Math.round(Math.max(0, Math.min(100, storedScore))),
    formula: "",
    scoringVersion: SCORING_VERSION,
    rawSubScores: {
      vendorRisk: vRisk,
      orgReadinessGap: storedOrg,
      integrationRisk: storedInt,
      vendorTrustScore: vtScore,
      intentMultiplier,
    },
    components: allComponents,
    warnings,
    missingEvidence,
    generatedAt: toIsoTimestamp(input.generatedAt) ?? new Date().toISOString(),
    internalOnly: true,
  };
}
