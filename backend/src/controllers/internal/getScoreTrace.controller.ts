/**
 * Internal Score Trace Controller
 *
 * INTERNAL USE ONLY — access gated by requireInternalUser middleware.
 * Must never be exposed to buyer or vendor users.
 *
 * Routes:
 *   GET /api/v1/internal/score-trace/irs/:assessmentId
 *   GET /api/v1/internal/score-trace/vts/:reportId
 */

import type { Request, Response } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../../database/db.js";
import { cotsBuyerAssessments } from "../../schema/assessments/cotsBuyerAssessments.js";
import { assessments } from "../../schema/assessments/assessments.js";
import { customerRiskAssessmentReports } from "../../schema/assessments/customerRiskAssessmentReports.js";
import { generatedProfileReports } from "../../schema/schema.js";
import { buildIrsScoreTrace } from "../../services/irsScoreTrace.js";
import { buildIrsFactorExplanations } from "../../services/irsFactorExplanations.js";
import { buildVtsScoreTrace } from "../../services/vtsScoreTrace.js";
import { buildScsScoreTrace } from "../../services/scsScoreTrace.js";
import { findAttestationForBuyerVendorProduct } from "../../services/findAttestationForBuyerVendorProduct.js";
import { scoreCotsBuyerWithPython } from "../../services/pythonScoringClient.js";
import { irsFinalScoreFromParts } from "../../services/buyerImplementationRiskScore.js";
import {
  appendixSalesRiskBreakdown,
  extractOverallRiskScoreFromReport,
} from "../../utils/mergeScoreRationale.js";

type IrsBreakdown = {
  vendorRisk: number;
  organizationalReadinessGap: number;
  integrationRisk: number;
  vendorTrustScore: number;
  intentMultiplier?: number;
};

function breakdownDrift(a: IrsBreakdown, b: IrsBreakdown): boolean {
  return (
    Math.abs(a.organizationalReadinessGap - b.organizationalReadinessGap) >= 1 ||
    Math.abs(a.integrationRisk - b.integrationRisk) >= 1 ||
    Math.abs(a.vendorRisk - b.vendorRisk) >= 1
  );
}

/**
 * When stored IRS was computed with older formula logic, refresh IRS fields in the
 * report JSON (keep LLM narrative) so score-trace and buyer readiness score match.
 */
async function refreshStaleIrsOnReport(opts: {
  assessmentId: string;
  report: Record<string, unknown>;
  buyerPayload: Record<string, unknown>;
  vendorName: string;
  productName: string;
  storedBreakdown: IrsBreakdown;
  storedScore: number;
}): Promise<{
  report: Record<string, unknown>;
  storedBreakdown: IrsBreakdown;
  storedScore: number;
  usedAttestation: boolean;
  refreshed: boolean;
}> {
  const { assessmentId, buyerPayload, vendorName, productName, storedBreakdown, storedScore } = opts;
  let report = opts.report;

  try {
    const attestation = await findAttestationForBuyerVendorProduct(vendorName, productName);
    const fresh = await scoreCotsBuyerWithPython({
      buyerPayload,
      attestationRow: attestation,
      vendorName,
      productName,
    });
    const intentMultiplier = Number(fresh.breakdown.intentMultiplier ?? 1);
    const parts = irsFinalScoreFromParts(
      Number(fresh.breakdown.vendorRisk ?? 0),
      Number(fresh.breakdown.organizationalReadinessGap ?? 0),
      Number(fresh.breakdown.integrationRisk ?? 0),
      Number.isFinite(intentMultiplier) && intentMultiplier > 0 ? intentMultiplier : 1,
    );
    const freshBreakdown: IrsBreakdown = {
      vendorRisk: parts.vendorRisk,
      organizationalReadinessGap: parts.orgGap,
      integrationRisk: parts.integrationRisk,
      vendorTrustScore: Math.round(Number(fresh.breakdown.vendorTrustScore ?? 50) * 100) / 100,
      intentMultiplier: Number.isFinite(intentMultiplier) ? intentMultiplier : 1,
    };
    const freshScore = parts.score;
    const scoreDrift = Math.abs(freshScore - storedScore) >= 1;
    if (!breakdownDrift(storedBreakdown, freshBreakdown) && !scoreDrift) {
      const riskSource =
        (report.implementationRiskSource as Record<string, unknown> | undefined) ??
        (report.source as Record<string, unknown> | undefined);
      return {
        report,
        storedBreakdown,
        storedScore,
        usedAttestation: Boolean(riskSource?.usedAttestation ?? fresh.source.usedAttestation),
        refreshed: false,
      };
    }

    const rationale = typeof fresh.rationale === "string" ? fresh.rationale.trim() : "";
    report = {
      ...report,
      implementationRiskScore: freshScore,
      implementationReadinessGrade: fresh.grade,
      implementationRiskClassification: fresh.classification,
      implementationRiskDecision: fresh.decision,
      implementationRiskRecommendedAction: fresh.recommendedAction,
      implementationRiskBreakdown: freshBreakdown,
      readinessProfile: fresh.readiness_profile,
      implementationRiskSource: fresh.source,
      scoreRationale: rationale || report.scoreRationale,
      scoreRationaleType: rationale ? "IRS" : report.scoreRationaleType,
      irsScoringVersion: fresh.scoring_version ?? "irs-1.1",
      irsRescoredAt: new Date().toISOString(),
    };

    await db
      .update(cotsBuyerAssessments)
      .set({
        vendor_risk_assessment_report: report,
        score_rationale: rationale || undefined,
        score_rationale_type: rationale ? "IRS" : undefined,
        updated_at: new Date(),
      })
      .where(eq(cotsBuyerAssessments.assessment_id, assessmentId));

    return {
      report,
      storedBreakdown: freshBreakdown,
      storedScore: freshScore,
      usedAttestation: Boolean(fresh.source.usedAttestation),
      refreshed: true,
    };
  } catch (e) {
    console.error("refreshStaleIrsOnReport:", e);
    const riskSource =
      (report.implementationRiskSource as Record<string, unknown> | undefined) ??
      (report.source as Record<string, unknown> | undefined);
    return {
      report,
      storedBreakdown,
      storedScore,
      usedAttestation: Boolean(riskSource?.usedAttestation),
      refreshed: false,
    };
  }
}

// ── IRS Trace ──────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/internal/score-trace/irs/:assessmentId
 *
 * assessmentId = the base assessment UUID (assessments.id).
 * Returns a ScoreTrace for the Buyer Implementation Risk Score.
 * If stored IRS was scored with older formula rules, refreshes IRS fields in-place.
 */
export async function getIrsScoreTrace(req: Request, res: Response): Promise<void> {
  try {
    const assessmentId = typeof req.params?.assessmentId === "string"
      ? req.params.assessmentId.trim()
      : "";

    if (!assessmentId) {
      res.status(400).json({ error: "assessmentId is required" });
      return;
    }

    // Fetch the buyer assessment row
    const [row] = await db
      .select({
        assessment_id:                    cotsBuyerAssessments.assessment_id,
        vendor_name:                      cotsBuyerAssessments.vendor_name,
        specific_product:                 cotsBuyerAssessments.specific_product,
        vendor_risk_assessment_report:    cotsBuyerAssessments.vendor_risk_assessment_report,
        // Scoring input fields (DB column names → camelCase keys for scoring)
        digital_maturity:                 cotsBuyerAssessments.digital_maturity,
        governance_maturity:              cotsBuyerAssessments.governance_maturity,
        ai_governance_board:              cotsBuyerAssessments.ai_governance_board,
        ai_ethics_policy:                 cotsBuyerAssessments.ai_ethics_policy,
        team_composition:                 cotsBuyerAssessments.team_composition,
        risk_appetite:                    cotsBuyerAssessments.risk_appetite,
        critical_of_ai_solution:          cotsBuyerAssessments.critical_of_ai_solution,
        integrate_system:                 cotsBuyerAssessments.integrate_system,
        gap_requirement_product:          cotsBuyerAssessments.gap_requirement_product,
        rollback_capability:              cotsBuyerAssessments.rollback_capability,
        vendor_usage_data:                cotsBuyerAssessments.vendor_usage_data,
        audit_logs:                       cotsBuyerAssessments.audit_logs,
        testing_results:                  cotsBuyerAssessments.testing_results,
        assessment_status:                assessments.status,
      })
      .from(cotsBuyerAssessments)
      .innerJoin(assessments, eq(cotsBuyerAssessments.assessment_id, assessments.id))
      .where(
        and(
          eq(cotsBuyerAssessments.assessment_id, assessmentId),
          eq(assessments.type, "cots_buyer"),
        ),
      )
      .limit(1);

    if (!row) {
      res.status(404).json({ error: "Buyer COTS assessment not found" });
      return;
    }

    const reportRaw = row.vendor_risk_assessment_report as Record<string, unknown> | null;
    if (!reportRaw) {
      res.status(404).json({
        error: "No vendor risk assessment report found for this assessment. Has it been submitted?",
      });
      return;
    }

    // Extract stored IRS values
    let storedScore = Number(reportRaw.implementationRiskScore ?? 0);
    const rawBreakdown = reportRaw.implementationRiskBreakdown as Record<string, unknown> | undefined;

    if (!rawBreakdown) {
      res.status(422).json({
        error: "implementationRiskBreakdown is missing from the stored report — cannot produce trace.",
      });
      return;
    }

    let storedBreakdown: IrsBreakdown = {
      vendorRisk:                  Number(rawBreakdown.vendorRisk                  ?? 0),
      organizationalReadinessGap:  Number(rawBreakdown.organizationalReadinessGap  ?? 0),
      integrationRisk:             Number(rawBreakdown.integrationRisk             ?? 0),
      vendorTrustScore:            Number(rawBreakdown.vendorTrustScore            ?? 50),
      intentMultiplier:            Number(rawBreakdown.intentMultiplier ?? 1) || 1,
    };

    // Reconstruct the buyer payload with camelCase keys (mirrors buildBuyerContextForReport)
    const buyerPayload: Record<string, unknown> = {
      digitalMaturityLevel:           row.digital_maturity,
      dataGovernanceMaturity:         row.governance_maturity,
      aiGovernanceBoard:              row.ai_governance_board,
      aiEthicsPolicy:                 row.ai_ethics_policy,
      implementationTeamComposition:  row.team_composition,
      riskAppetite:                   row.risk_appetite,
      criticality:                    row.critical_of_ai_solution,
      integrationSystems:             row.integrate_system,
      requirementGaps:                row.gap_requirement_product,
      rollbackCapability:             row.rollback_capability,
      monitoringDataAvailable:        row.vendor_usage_data,
      auditLogsAvailable:             row.audit_logs,
      testingResultsAvailable:        row.testing_results,
    };

    const vendorName = String(row.vendor_name ?? "Vendor");
    const productName = String(row.specific_product ?? "Product");

    const riskSource =
      (reportRaw.implementationRiskSource as Record<string, unknown> | undefined) ??
      (reportRaw.source as Record<string, unknown> | undefined);
    let usedAttestation = Boolean(riskSource?.usedAttestation);

    let probe = buildIrsScoreTrace({
      buyerPayload,
      storedBreakdown,
      storedScore,
      usedAttestation,
      vendorName,
      productName,
    });
    const needsRefresh = probe.warnings.some(
      (w) =>
        w.includes("reconciliation mismatch") ||
        w.includes("canonical formula from breakdown"),
    );

    let irsRefreshed = false;
    if (needsRefresh) {
      const refreshed = await refreshStaleIrsOnReport({
        assessmentId,
        report: reportRaw,
        buyerPayload,
        vendorName,
        productName,
        storedBreakdown,
        storedScore,
      });
      storedBreakdown = refreshed.storedBreakdown;
      storedScore = refreshed.storedScore;
      usedAttestation = refreshed.usedAttestation;
      irsRefreshed = refreshed.refreshed;
      probe = buildIrsScoreTrace({
        buyerPayload,
        storedBreakdown,
        storedScore,
        usedAttestation,
        vendorName,
        productName,
      });
      if (irsRefreshed) {
        probe.warnings = [
          `Stored readiness score was updated to ${storedScore} so buyer report and Explainability use the same IRS formula.`,
          ...probe.warnings.filter(
            (w) =>
              !w.includes("reconciliation mismatch") &&
              !w.includes("canonical formula from breakdown"),
          ),
        ];
      }
    }

    const irsFactorExplanations = buildIrsFactorExplanations(probe);

    res.status(200).json({
      success: true,
      data: { ...probe, irsFactorExplanations, irsRefreshed },
    });
  } catch (e) {
    console.error("getIrsScoreTrace:", e);
    res.status(500).json({ error: "Failed to generate IRS score trace" });
  }
}

// ── VTS Trace ──────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/internal/score-trace/vts/:reportId
 *
 * reportId = the generated_profile_reports UUID.
 * Returns a ScoreTrace for the Vendor Trust Score.
 */
export async function getVtsScoreTrace(req: Request, res: Response): Promise<void> {
  try {
    const reportId = typeof req.params?.reportId === "string"
      ? req.params.reportId.trim()
      : "";

    if (!reportId) {
      res.status(400).json({ error: "reportId is required" });
      return;
    }

    const selectFields = {
      id:             generatedProfileReports.id,
      trust_score:    generatedProfileReports.trust_score,
      report:         generatedProfileReports.report,
      attestation_id: generatedProfileReports.attestation_id,
      product_risk:   generatedProfileReports.product_risk,
      governance_risk: generatedProfileReports.governance_risk,
      operational_risk: generatedProfileReports.operational_risk,
    };

    // Primary lookup: reportId is the generated_profile_reports UUID
    let [row] = await db
      .select(selectFields)
      .from(generatedProfileReports)
      .where(eq(generatedProfileReports.id, reportId))
      .limit(1);

    // Fallback: treat reportId as a vendor_self_attestations UUID (vendorAttestationId from listing)
    if (!row) {
      [row] = await db
        .select(selectFields)
        .from(generatedProfileReports)
        .where(eq(generatedProfileReports.attestation_id, reportId))
        .orderBy(desc(generatedProfileReports.created_at))
        .limit(1);
    }

    if (!row) {
      res.status(404).json({
        error: "Score trace unavailable: no stored score breakdown for this vendor assessment. Submit a new attestation to generate one.",
      });
      return;
    }

    const report = row.report as Record<string, unknown> | null;
    const trustScoreBlock = (report?.trustScore ?? report?.trust_score) as
      | Record<string, unknown>
      | undefined;
    const rawScoreByCategory = trustScoreBlock?.scoreByCategory as
      | Record<string, unknown>
      | undefined;

    let scoreByCategory: Record<string, number> | null = rawScoreByCategory
      ? Object.fromEntries(
          Object.entries(rawScoreByCategory)
            .filter(([, v]) => typeof v === "number" || (typeof v === "string" && Number.isFinite(Number(v))))
            .map(([k, v]) => [k, Number(v)]),
        )
      : null;

    // Fallback: derive category scores from stored risk columns (formula path)
    if (!scoreByCategory || Object.keys(scoreByCategory).length === 0) {
      const pr = row.product_risk != null && Number.isFinite(Number(row.product_risk))
        ? Number(row.product_risk) : null;
      const gr = row.governance_risk != null && Number.isFinite(Number(row.governance_risk))
        ? Number(row.governance_risk) : null;
      const opr = row.operational_risk != null && Number.isFinite(Number(row.operational_risk))
        ? Number(row.operational_risk) : null;
      if (pr != null && gr != null && opr != null) {
        scoreByCategory = {
          Product: Math.max(0, Math.min(100, 100 - pr)),
          Governance: Math.max(0, Math.min(100, 100 - gr)),
          Operational: Math.max(0, Math.min(100, 100 - opr)),
        };
      }
    }

    const rawFactorExplanations = trustScoreBlock?.factorExplanations;
    const factorExplanations = Array.isArray(rawFactorExplanations) ? rawFactorExplanations : undefined;

    const trace = buildVtsScoreTrace({
      storedTrustScore: Number(row.trust_score ?? 0),
      scoreByCategory:  Object.keys(scoreByCategory ?? {}).length > 0 ? scoreByCategory : null,
      reportId: row.id,
      attestationId:    row.attestation_id ?? null,
      factorExplanations,
    });

    res.status(200).json({ success: true, data: trace });
  } catch (e) {
    console.error("getVtsScoreTrace:", e);
    res.status(500).json({ error: "Failed to generate VTS score trace" });
  }
}

// ── SCS Trace (Type 2 — Vendor COTS / Sales Confidence) ───────────────────────

/**
 * GET /api/v1/internal/score-trace/scs/:assessmentId
 *
 * assessmentId = the base assessment UUID (assessments.id).
 * Returns a ScoreTrace for Sales Confidence (= 100 − sales risk).
 */
export async function getScsScoreTrace(req: Request, res: Response): Promise<void> {
  try {
    const assessmentId =
      typeof req.params?.assessmentId === "string" ? req.params.assessmentId.trim() : "";

    if (!assessmentId) {
      res.status(400).json({ error: "assessmentId is required" });
      return;
    }

    const [row] = await db
      .select({
        id: customerRiskAssessmentReports.id,
        report: customerRiskAssessmentReports.report,
        title: customerRiskAssessmentReports.title,
        score_rationale: customerRiskAssessmentReports.score_rationale,
      })
      .from(customerRiskAssessmentReports)
      .where(eq(customerRiskAssessmentReports.assessment_id, assessmentId))
      .orderBy(desc(customerRiskAssessmentReports.created_at))
      .limit(1);

    if (!row) {
      res.status(404).json({
        error:
          "Score trace unavailable: no stored customer risk report for this Vendor COTS assessment.",
      });
      return;
    }

    const report =
      row.report != null && typeof row.report === "object" && !Array.isArray(row.report)
        ? (row.report as Record<string, unknown>)
        : null;

    if (!report) {
      res.status(404).json({ error: "Stored report is empty — cannot produce SCS score trace." });
      return;
    }

    const breakdown = appendixSalesRiskBreakdown(report);
    const storedSalesRisk =
      extractOverallRiskScoreFromReport(report) ??
      (breakdown != null
        ? Number(breakdown.sales_risk_score ?? breakdown.salesRiskScore)
        : NaN);

    if (!Number.isFinite(storedSalesRisk)) {
      res.status(422).json({
        error: "Sales risk score is missing from the stored report — cannot produce trace.",
      });
      return;
    }

    const dealProbability =
      breakdown != null &&
      Number.isFinite(Number(breakdown.deal_probability_pct ?? breakdown.dealProbabilityPct))
        ? Number(breakdown.deal_probability_pct ?? breakdown.dealProbabilityPct)
        : null;

    const detailRaw =
      (breakdown?.detail != null &&
      typeof breakdown.detail === "object" &&
      !Array.isArray(breakdown.detail)
        ? (breakdown.detail as Record<string, unknown>)
        : null) ??
      (() => {
        const gen = report.generatedAnalysis ?? report.generated_analysis;
        if (gen == null || typeof gen !== "object" || Array.isArray(gen)) return null;
        const full =
          (gen as Record<string, unknown>).fullReport ??
          (gen as Record<string, unknown>).full_report;
        if (full == null || typeof full !== "object" || Array.isArray(full)) return null;
        const appendix = (full as Record<string, unknown>).appendix;
        if (appendix == null || typeof appendix !== "object" || Array.isArray(appendix)) return null;
        const d =
          (appendix as Record<string, unknown>).salesRiskDetail ??
          (appendix as Record<string, unknown>).sales_risk_detail;
        return d != null && typeof d === "object" && !Array.isArray(d)
          ? (d as Record<string, unknown>)
          : null;
      })();

    const trace = buildScsScoreTrace({
      storedSalesRisk: Number(storedSalesRisk),
      dealProbability,
      customerFrictionRisk:
        breakdown != null
          ? Number(breakdown.customer_friction_risk ?? breakdown.customerFrictionRisk)
          : null,
      implementationRisk:
        breakdown != null
          ? Number(breakdown.implementation_risk ?? breakdown.implementationRisk)
          : null,
      competitiveRisk:
        breakdown != null
          ? Number(breakdown.competitive_risk ?? breakdown.competitiveRisk)
          : null,
      assessmentId,
      assessmentTitle: row.title?.trim() || null,
      grade: breakdown != null ? String(breakdown.grade ?? "").trim() || null : null,
      classification:
        breakdown != null ? String(breakdown.classification ?? "").trim() || null : null,
      detail:
        detailRaw != null && typeof detailRaw === "object" && !Array.isArray(detailRaw)
          ? (detailRaw as Record<string, unknown>)
          : null,
    });

    res.status(200).json({ success: true, data: trace });
  } catch (e) {
    console.error("getScsScoreTrace:", e);
    res.status(500).json({ error: "Failed to generate SCS score trace" });
  }
}

