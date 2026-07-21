/**
 * VTS Score Trace — internal operator explainability only.
 *
 * Builds a ScoreTrace from stored generated_profile_reports data.
 *
 * The VTS formula has many sub-factors (likelihood, impact, 9-step product risk chain,
 * 5 governance sub-components, 5 operational sub-components). The full intermediate
 * detail is NOT stored in generated_profile_reports — only the final trust_score and
 * scoreByCategory (Product / Governance / Operational) are persisted.
 *
 * This trace therefore operates at the CATEGORY level:
 * - Product risk contribution  = ProductRisk × 0.40
 * - Governance risk contribution = GovernanceRisk × 0.30
 * - Operational risk contribution = OperationalRisk × 0.30
 *
 * Each category's contribution to the final VTS is emitted as a component.
 * A warning explains that per-sub-factor detail (cert-level, policy-level, SLA-level)
 * is not available from stored data and would require re-scoring from attestation form data.
 *
 * INTERNAL USE ONLY — never return this data to buyer or vendor users.
 */

import { SCORING_VERSION } from "../lib/scoringVersion.js";
import type { ScoreTrace, ScoreTraceComponent } from "../types/scoreTrace.js";
import type { FactorExplanation } from "./vtsFactorExplanations.js";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
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

export type VtsTraceInput = {
  /** Stored trust_score from generated_profile_reports (integer 0–100). */
  storedTrustScore: number;
  /**
   * Stored scoreByCategory from generated_profile_reports.report.trustScore.
   * Keys are "Product", "Governance", "Operational" (0–100, where higher = better).
   */
  scoreByCategory: Record<string, number> | null;
  /** Report ID for context in warnings. */
  reportId: string;
  /** attestation_id from generated_profile_reports (may be null if not linked). */
  attestationId: string | null;
  /**
   * Factor-level explanations from stored report (formula path only).
   * When present, warnings about missing per-factor detail are suppressed.
   */
  factorExplanations?: FactorExplanation[];
};

export function buildVtsScoreTrace(input: VtsTraceInput): ScoreTrace {
  const { storedTrustScore, scoreByCategory, reportId, attestationId, factorExplanations } = input;
  const hasFactorDetail = Array.isArray(factorExplanations) && factorExplanations.length > 0;
  const warnings: string[] = [];
  const missingEvidence: string[] = [];

  const productScore  = typeof scoreByCategory?.["Product"]     === "number" ? scoreByCategory["Product"]     : null;
  const govScore      = typeof scoreByCategory?.["Governance"]  === "number" ? scoreByCategory["Governance"]  : null;
  const opsScore      = typeof scoreByCategory?.["Operational"] === "number" ? scoreByCategory["Operational"] : null;

  const hasCategories = productScore !== null && govScore !== null && opsScore !== null;

  const components: ScoreTraceComponent[] = [];

  if (hasCategories) {
    // Convert category scores (0–100, higher = better) to sub-risks (0–100, higher = worse)
    const productRisk     = Math.max(0, Math.min(100, 100 - productScore!));
    const governanceRisk  = Math.max(0, Math.min(100, 100 - govScore!));
    const operationalRisk = Math.max(0, Math.min(100, 100 - opsScore!));

    // Each sub-risk deducts from the base VTS of 100
    const productContrib    = -(productRisk    * 0.40);
    const governanceContrib = -(governanceRisk * 0.30);
    const operationalContrib= -(operationalRisk* 0.30);

    // Reconcile
    const recomputed = round2(Math.max(0, 100 + productContrib + governanceContrib + operationalContrib));
    if (Math.abs(recomputed - storedTrustScore) > 2) {
      warnings.push(
        `Score reconciliation mismatch: category scores (Product=${productScore}, Governance=${govScore}, Operational=${opsScore}) ` +
          `recompute to VTS≈${recomputed}, but stored trust_score is ${storedTrustScore}. ` +
          `Treating stored score as authoritative. This may indicate rounding differences or that ` +
          `the report was generated via the LLM path (not the formula path).`,
      );
    }

    components.push(
      component(
        "Product Risk (Likelihood × Impact × Contextual Multipliers)",
        "Product",
        productContrib,
        `Product score = ${productScore}/100; Product risk = ${productRisk}. Deducts ${round2(productRisk * 0.40)} from base VTS (weight 40%).`,
        "vendor_attestation",
        "Vendor attestation profile",
      ),
    );

    components.push(
      component(
        "Governance Risk (Certifications + Policies + Controls + Maturity)",
        "Governance",
        governanceContrib,
        `Governance score = ${govScore}/100; Governance risk = ${governanceRisk}. Deducts ${round2(governanceRisk * 0.30)} from base VTS (weight 30%). ` +
          `Includes: certifications (SOC 2, ISO 27001, HIPAA, etc.), assessment quality, data retention/incident response policies, operational controls, vendor maturity.`,
        "vendor_attestation",
        "Vendor attestation profile",
      ),
    );

    components.push(
      component(
        "Operational Risk (SLAs + Incident Management + Stability + Support)",
        "Operational",
        operationalContrib,
        `Operational score = ${opsScore}/100; Operational risk = ${operationalRisk}. Deducts ${round2(operationalRisk * 0.30)} from base VTS (weight 30%). ` +
          `Includes: SLA uptime commitment, incident response maturity, deployment scale, company stability, support tier.`,
        "vendor_attestation",
        "Vendor attestation profile",
      ),
    );

    // Sub-factor hints based on low category scores
    if (govScore !== null && govScore < 50) {
      missingEvidence.push(
        `Governance score is ${govScore}/100 — common causes: missing SOC 2 Type 2 certification (+15 pts), ` +
          `missing ISO 27001 (+10 pts), no incident response plan (+10 pts), no AI ethics policy (+8 pts).`,
      );
    }
    if (opsScore !== null && opsScore < 50) {
      missingEvidence.push(
        `Operational score is ${opsScore}/100 — common causes: low SLA uptime commitment, no 24/7 support tier, ` +
          `early-stage company, limited deployment scale.`,
      );
    }
    if (productScore !== null && productScore < 50) {
      missingEvidence.push(
        `Product score is ${productScore}/100 — reflects high inherent risk from likelihood/impact scores, ` +
          `low mitigation effectiveness, or low confidence factor (e.g., self-reported only, no third-party audit).`,
      );
    }
  } else {
    warnings.push(
      `scoreByCategory (Product/Governance/Operational) is missing from the stored report (report ID: ${reportId}). ` +
        `This may mean the report was generated via the LLM path without formula data, or from an older scoring version. ` +
        `Category-level breakdown is not available.`,
    );
    missingEvidence.push(
      "No scoreByCategory data available — re-generating the profile with formula data would produce a detailed breakdown.",
    );
  }

  if (!hasFactorDetail) {
    if (!attestationId) {
      warnings.push(
        `This profile report (ID: ${reportId}) was not linked to a vendor self-attestation row. ` +
          `Per-factor sub-breakdown (certification-level, policy-level) requires the attestation form data and is not available here.`,
      );
    } else {
      warnings.push(
        `Per-factor sub-breakdown (e.g., which certifications were detected, which policies were present) ` +
          `is not stored in generated_profile_reports and requires re-scoring from attestation form data. ` +
          `Attestation ID: ${attestationId}.`,
      );
    }
  }

  return {
    scoreType: "vendor_trust",
    finalScore: storedTrustScore,
    formula: "VTS = 100 − [(Product_Risk × 0.40) + (Governance_Risk × 0.30) + (Operational_Risk × 0.30)]",
    scoringVersion: SCORING_VERSION,
    rawSubScores: {
      productScore:    productScore    ?? undefined,
      governanceScore: govScore        ?? undefined,
      operationalScore: opsScore       ?? undefined,
    },
    components,
    warnings,
    missingEvidence,
    factorExplanations: hasFactorDetail ? factorExplanations : undefined,
    generatedAt: new Date().toISOString(),
    internalOnly: true,
  };
}
