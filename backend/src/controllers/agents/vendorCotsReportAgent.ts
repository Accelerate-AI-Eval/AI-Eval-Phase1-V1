import "dotenv/config";
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

const REGION = process.env.AWS_DEFAULT_REGION || "us-east-1";
// const MODEL_ID ="us.anthropic.claude-haiku-4-5-20251001-v1:0";
const MODEL_ID = "anthropic.claude-3-sonnet-20240229-v1:0";

const client = new BedrockRuntimeClient({ region: REGION });

import {
  getTop5RisksWithMitigations,
  formatTop5RisksForPrompt,
  type Top5RisksWithMitigations,
} from "../../services/getTop5RisksFromAssessmentContext.js";

export interface RecommendationWithPriority {
  priority: "High" | "Medium" | "Low";
  title: string;
  description: string;
  timeline: string;
}

export interface RoiAnalysis {
  timeSavedPerEmployee?: string;
  timeSavedSource?: string;
  annualHoursRecovered?: string;
  annualHoursRecoveredCalculation?: string;
  productivityValue?: string;
  productivityValueCalculation?: string;
  annualCost?: string;
  annualCostCalculation?: string;
  roiMultiple?: string;
  roiMultipleCalculation?: string;
  paybackPeriod?: string;
  paybackSource?: string;
  comparisonAlternatives?: { alternative: string; annualCost: string; roi: string; notes: string }[];
}

export interface RiskCategoryBlock {
  name: string;
  initialRisk?: string;
  level?: string;
  score?: string;
  risks: string[];
  mitigations: string[];
  residualRisk?: string;
}

export interface ComplianceRequirement {
  name: string;
  description: string;
  status: "Met" | "Pending" | "Deferred";
}

export interface FrameworkRow {
  framework: string;
  coverage: string;
  controls: string;
  notes: string;
}

export interface ImplementationPhase {
  title: string;
  timeline: string;
  status: "Complete" | "In Progress" | "Planned";
  activities: string[];
  deliverables: string[];
  pilotResults?: { activeUsage?: string; timeSaved?: string; securityIncidents?: string; satisfaction?: string; testimonial?: string };
}

export interface Appendix {
  methodology?: string;
  preparedBy?: string;
  reviewedBy?: string;
  confidentiality?: string;
  dataSources?: string[];
}

export interface FullReportJson {
  roiAnalysis?: RoiAnalysis;
  securityPosture?: RiskCategoryBlock;
  complianceAlignment?: { summary?: string; requirements?: ComplianceRequirement[] };
  frameworkMapping?: { rows?: FrameworkRow[] };
  implementationPlan?: { phases?: ImplementationPhase[] };
  competitivePositioning?: string;
  appendix?: Appendix;
}

/** LLM-written short bullets per catalog-matched risk (merged into report.dbTop5Risks on save). */
export interface MatchedRiskSummary {
  risk_id: string;
  summary_points: string[];
}

/** LLM-written short bullets per catalog mitigation (merged into report.dbTop5Risks.mitigationsByRiskId on save). */
export interface MatchedMitigationSummary {
  risk_id: string;
  mitigation_action_name: string;
  summary_points: string[];
}

export interface GeneratedVendorCotsReport {
  overallRiskScore: number;
  riskLevel: string;
  summary: string;
  executiveSummary?: string;
  keyRisks: string[];
  recommendations: string[];
  recommendationsWithPriority?: RecommendationWithPriority[];
  fullReport?: FullReportJson;
  /** Model-generated concise bullets for each DB top-5 risk (keyed by risk_id). */
  matchedRiskSummaries?: MatchedRiskSummary[];
  /** Model-generated concise bullets per listed catalog mitigation (risk_id + exact action name). */
  matchedMitigationSummaries?: MatchedMitigationSummary[];
  raw?: string;
}

const VENDOR_COTS_REPORT_PROMPT = `You are a risk analyst. Using ONLY the vendor COTS (Commercial Off-The-Shelf) assessment data provided below, generate a structured Analysis Report.

Output the report in the following sections with clear headings. Use the exact section titles below.

## 0. Risk Score
- **Overall Risk Score:** [0-100] (higher = higher risk)
- **Risk Level:** [Low | Moderate | High]
- **Summary:** 2–4 sentences summarizing the overall risk posture for this customer engagement.

## 1. Executive Summary
Write 2–5 paragraphs as a narrative executive summary. Include: deployment context, key benefits or outcomes, infrastructure/security highlights, risk conclusion (e.g. low overall risk with manageable mitigations), and a brief recommendation (e.g. recommend proceeding with deployment). Use professional tone.

## 2. Key Risks
List 3–6 key risks as bullet points. Each line: "- [risk description]". Base these on: identified_risks, customer_specific_risks, data_sensitivity, regulatory_requirements, integration_complexity, and risk_domain_scores if provided.

## 3. Recommendations
List 3–6 actionable recommendations. For each line use this format: "- **Priority:** [High|Medium|Low] | **Title:** [short title] | **Description:** [1-2 sentences] | **Timeline:** [e.g. Immediate, Within 30 days, Q2 2026]"

If a "Database-matched top risks and mitigations" section is provided below, incorporate those risks and their recommended mitigations into your Key Risks and Recommendations where relevant.

## 4. REPORT_JSON
After the sections above, output a single JSON object in a fenced code block starting with \`\`\`json and ending with \`\`\`. The JSON must contain only these keys (use empty strings or empty arrays if not applicable). Infer reasonable values from the assessment data.
- roiAnalysis: object with timeSavedPerEmployee (string), timeSavedSource (string), annualHoursRecovered, productivityValue, annualCost, roiMultiple, paybackPeriod, paybackSource; comparisonAlternatives: array of { alternative, annualCost, roi, notes }
- securityPosture: object with level (string), score (string e.g. "8/100"), risks (string array — each string ONE short bullet phrase, max ~25 words, not paragraphs), mitigations (string array of short actionable lines), residualRisk (string)
- matchedRiskSummaries: array. If "Database-matched top risks" appears above, include exactly one object per listed catalog risk (same order, max 5). Each: { "risk_id": "<exact Risk [id] from that section>", "summary_points": ["2-4 concise bullets", "..."] } — bullets only from that risk's title/description; each bullet under 25 words; no generic filler. If no database-matched risks, use [].
- matchedMitigationSummaries: array. For every "Mitigation:" line under those risks (same order), include { "risk_id": "<exact Risk [id]>", "mitigation_action_name": "<exact mitigation action name before '(' from that line>", "summary_points": ["1-3 complete sentences or short bullets", "..."] } — summarize only that mitigation's catalog meaning (name + definition text above); each bullet a full thought (not truncated mid-sentence); under 35 words each; no generic filler. If a risk has no mitigations, omit entries for it. If no database-matched risks, use [].
- complianceAlignment: object with summary (string), requirements: array of { name, description, status: "Met"|"Pending"|"Deferred" }
- frameworkMapping: object with rows: array of { framework, coverage, controls, notes }
- implementationPlan: object with phases: array of { title, timeline, status: "Complete"|"In Progress"|"Planned", activities (string array), deliverables (string array) }
- competitivePositioning: string (2-4 sentences)
- appendix: object with methodology (string), preparedBy (string), reviewedBy (string), confidentiality (string), dataSources (string array)

Use only the data provided; if a field is empty or "Not specified", say so or use empty value. Be concise.
`;

function buildAssessmentContext(payload: Record<string, unknown>, top5: Top5RisksWithMitigations | null): string {
  const toStr = (v: unknown): string => {
    if (v == null) return "Not specified";
    if (Array.isArray(v)) return v.length ? v.map(toStr).join(", ") : "Not specified";
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
  };
  const lines: string[] = [
    "--- Vendor COTS Assessment Data ---",
    `Customer organization: ${toStr(payload.customer_organization_name ?? payload.customerOrganizationName)}`,
    `Customer sector: ${toStr(payload.customer_sector ?? payload.customerSector)}`,
    `Primary pain point: ${toStr(payload.primary_pain_point ?? payload.primaryPainPoint)}`,
    `Expected outcomes: ${toStr(payload.expected_outcomes ?? payload.expectedOutcomes)}`,
    `Customer budget range: ${toStr(payload.customer_budget_range ?? payload.customerBudgetRange)}`,
    `Implementation timeline: ${toStr(payload.implementation_timeline ?? payload.implementationTimeline)}`,
    `Product features: ${toStr(payload.product_features ?? payload.productFeatures)}`,
    `Implementation approach: ${toStr(payload.implementation_approach ?? payload.implementationApproach)}`,
    `Customization level: ${toStr(payload.customization_level ?? payload.customizationLevel)}`,
    `Integration complexity: ${toStr(payload.integration_complexity ?? payload.integrationComplexity)}`,
    `Regulatory requirements: ${toStr(payload.regulatory_requirements ?? payload.regulatoryRequirements)}`,
    `Regulatory requirements (other): ${toStr(payload.regulatory_requirements_other ?? payload.regulatoryRequirementsOther)}`,
    `Data sensitivity: ${toStr(payload.data_sensitivity ?? payload.dataSensitivity)}`,
    `Customer risk tolerance: ${toStr(payload.customer_risk_tolerance ?? payload.customerRiskTolerance)}`,
    `Alternatives considered: ${toStr(payload.alternatives_considered ?? payload.alternativesConsidered)}`,
    `Key advantages: ${toStr(payload.key_advantages ?? payload.keyAdvantages)}`,
    `Customer-specific risks: ${toStr(payload.customer_specific_risks ?? payload.customerSpecificRisks)}`,
    `Customer-specific risks (other): ${toStr(payload.customer_specific_risks_other ?? payload.customerSpecificRisksOther)}`,
    `Identified risks: ${toStr(payload.identified_risks ?? payload.identifiedRisks)}`,
    `Risk domain scores: ${toStr(payload.risk_domain_scores ?? payload.riskDomainScores)}`,
    `Contextual multipliers: ${toStr(payload.contextual_multipliers ?? payload.contextualMultipliers)}`,
    `Risk mitigation: ${toStr(payload.risk_mitigation ?? payload.riskMitigation)}`,
    "--- End of data ---",
  ];
  const dbSection = formatTop5RisksForPrompt(top5);
  if (dbSection) lines.push("", dbSection);
  return lines.join("\n");
}

function parseReportSections(rawReply: string): GeneratedVendorCotsReport {
  let overallRiskScore = 0;
  let riskLevel = "Moderate";
  let summary = "";
  let executiveSummary = "";
  const keyRisks: string[] = [];
  const recommendations: string[] = [];
  const recommendationsWithPriority: RecommendationWithPriority[] = [];

  const section0 = rawReply.match(/##\s*0\.?\s*Risk Score[\s\S]*?(?=\n\s*##\s*1|$)/i)?.[0] ?? "";
  if (section0) {
    const scoreMatch = section0.match(/\*\*Overall Risk Score\*\*:\s*(\d+)/i) ?? section0.match(/Overall Risk Score\s*:\s*(\d+)/i);
    if (scoreMatch) {
      const n = parseInt(scoreMatch[1], 10);
      overallRiskScore = Math.min(100, Math.max(0, n));
    }
    const levelMatch = section0.match(/\*\*Risk Level\*\*:\s*([^\n*]+)/i) ?? section0.match(/Risk Level\s*:\s*([^\n*]+)/i);
    if (levelMatch) riskLevel = levelMatch[1].trim().slice(0, 50) || "Moderate";
    const summaryMatch =
      section0.match(/\*\*Summary\*\*:\s*([\s\S]*?)(?=\n\s*##|\n\s*[-*]\s*\*\*[A-Za-z]|$)/im) ??
      section0.match(/Summary:\s*([\s\S]*?)(?=\n\s*##|\n\s*[-*]\s*\*\*|$)/im);
    if (summaryMatch) summary = summaryMatch[1].replace(/\n+/g, " ").trim();
  }

  const section1 = rawReply.match(/##\s*1\.?\s*Executive Summary[\s\S]*?(?=\n\s*##\s*2|$)/i)?.[0] ?? "";
  if (section1) {
    const content = section1.replace(/##\s*1\.?\s*Executive Summary\s*/i, "").trim();
    executiveSummary = content.split(/\n/).map((l) => l.trim()).filter(Boolean).join("\n\n");
  }

  let section2 = rawReply.match(/##\s*2\.?\s*Key Risks[\s\S]*?(?=\n\s*##\s*3|$)/i)?.[0] ?? "";
  if (!section2) section2 = rawReply.match(/##\s*1\.?\s*Key Risks[\s\S]*?(?=\n\s*##\s*2|$)/i)?.[0] ?? "";
  if (section2) {
    const bullets = section2.split(/\n/).filter((line) => /^\s*[-*]\s+/.test(line));
    for (const b of bullets) {
      const text = b.replace(/^\s*[-*]\s+/, "").trim();
      if (text.length > 0) keyRisks.push(text);
    }
  }

  let section3 = rawReply.match(/##\s*3\.?\s*Recommendations[\s\S]*?(?=\n\s*##|$)/i)?.[0] ?? "";
  if (!section3) section3 = rawReply.match(/##\s*2\.?\s*Recommendations[\s\S]*?(?=\n\s*##|$)/i)?.[0] ?? "";
  if (section3) {
    const lines = section3.split(/\n/).filter((line) => /^\s*[-*]\s+/.test(line));
    for (const line of lines) {
      const text = line.replace(/^\s*[-*]\s+/, "").trim();
      if (!text) continue;
      const priMatch = text.match(/\*\*Priority:\*\*\s*(\w+)/i);
      const titleMatch = text.match(/\*\*Title:\*\*\s*([^|]+)/);
      const descMatch = text.match(/\*\*Description:\*\*\s*([^|]+)/);
      const timeMatch = text.match(/\*\*Timeline:\*\*\s*([^|]+)/);
      if (priMatch && titleMatch) {
        const priority = (priMatch[1].trim() === "High" || priMatch[1].trim() === "Medium" || priMatch[1].trim() === "Low"
          ? priMatch[1].trim()
          : "Medium") as "High" | "Medium" | "Low";
        recommendationsWithPriority.push({
          priority,
          title: titleMatch[1].trim(),
          description: descMatch ? descMatch[1].trim() : "",
          timeline: timeMatch ? timeMatch[1].trim() : "",
        });
      }
      recommendations.push(text);
    }
  }

  if (overallRiskScore === 0 && /\d{1,3}/.test(rawReply)) {
    const anyNum = rawReply.match(/\*\*Overall Risk Score\*\*[^\d]*(\d{1,3})/i)?.[1] ?? rawReply.match(/Risk Score[^\d]*(\d{1,3})/i)?.[1];
    if (anyNum) overallRiskScore = Math.min(100, Math.max(0, parseInt(anyNum, 10)));
  }

  let fullReport: FullReportJson | undefined;
  let matchedRiskSummaries: MatchedRiskSummary[] | undefined;
  let matchedMitigationSummaries: MatchedMitigationSummary[] | undefined;
  const jsonBlock = rawReply.match(/```json\s*([\s\S]*?)```/)?.[1] ?? rawReply.match(/---REPORT_JSON---\s*([\s\S]*?)(?=\n---|$)/)?.[1];
  if (jsonBlock) {
    try {
      const parsed = JSON.parse(jsonBlock.trim()) as Record<string, unknown>;
      fullReport = {
        roiAnalysis: sanitizeRoi(parsed.roiAnalysis),
        securityPosture: sanitizeRiskCategoryBlock(parsed.securityPosture),
        complianceAlignment: sanitizeComplianceAlignment(parsed.complianceAlignment),
        frameworkMapping: sanitizeFrameworkMapping(parsed.frameworkMapping),
        implementationPlan: sanitizeImplementationPlan(parsed.implementationPlan),
        competitivePositioning: typeof parsed.competitivePositioning === "string" ? parsed.competitivePositioning : undefined,
        appendix: sanitizeAppendix(parsed.appendix),
      };
      matchedRiskSummaries = sanitizeMatchedRiskSummaries(parsed.matchedRiskSummaries);
      matchedMitigationSummaries = sanitizeMatchedMitigationSummaries(parsed.matchedMitigationSummaries);
    } catch {
      // ignore invalid JSON
    }
  }

  return {
    overallRiskScore,
    riskLevel,
    summary: summary || "No summary generated.",
    executiveSummary: executiveSummary || undefined,
    keyRisks,
    recommendations,
    recommendationsWithPriority: recommendationsWithPriority.length > 0 ? recommendationsWithPriority : undefined,
    fullReport,
    matchedRiskSummaries,
    matchedMitigationSummaries,
  };
}

function sanitizeMatchedRiskSummaries(v: unknown): MatchedRiskSummary[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: MatchedRiskSummary[] = [];
  for (const x of v) {
    if (x == null || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    const risk_id = String(o.risk_id ?? "").trim();
    if (!risk_id) continue;
    const summary_points = Array.isArray(o.summary_points)
      ? (o.summary_points as unknown[])
          .map((p) => String(p ?? "").trim())
          .filter((s) => s.length > 1)
          .slice(0, 8)
      : [];
    if (summary_points.length === 0) continue;
    out.push({ risk_id, summary_points });
  }
  return out.length > 0 ? out : undefined;
}

function sanitizeMatchedMitigationSummaries(v: unknown): MatchedMitigationSummary[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: MatchedMitigationSummary[] = [];
  for (const x of v) {
    if (x == null || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    const risk_id = String(o.risk_id ?? "").trim();
    const mitigation_action_name = String(o.mitigation_action_name ?? "").trim();
    if (!risk_id || !mitigation_action_name) continue;
    const summary_points = Array.isArray(o.summary_points)
      ? (o.summary_points as unknown[])
          .map((p) => String(p ?? "").trim())
          .filter((s) => s.length > 1)
          .slice(0, 6)
      : [];
    if (summary_points.length === 0) continue;
    out.push({ risk_id, mitigation_action_name, summary_points });
  }
  return out.length > 0 ? out : undefined;
}

function sanitizeRoi(v: unknown): RoiAnalysis | undefined {
  if (v == null || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  const arr = Array.isArray(o.comparisonAlternatives)
    ? (o.comparisonAlternatives as unknown[]).map((x) => {
        const t = x && typeof x === "object" ? (x as Record<string, unknown>) : {};
        return { alternative: String(t.alternative ?? ""), annualCost: String(t.annualCost ?? ""), roi: String(t.roi ?? ""), notes: String(t.notes ?? "") };
      })
    : undefined;
  return {
    timeSavedPerEmployee: typeof o.timeSavedPerEmployee === "string" ? o.timeSavedPerEmployee : undefined,
    timeSavedSource: typeof o.timeSavedSource === "string" ? o.timeSavedSource : undefined,
    annualHoursRecovered: typeof o.annualHoursRecovered === "string" ? o.annualHoursRecovered : undefined,
    annualHoursRecoveredCalculation: typeof o.annualHoursRecoveredCalculation === "string" ? o.annualHoursRecoveredCalculation : undefined,
    productivityValue: typeof o.productivityValue === "string" ? o.productivityValue : undefined,
    productivityValueCalculation: typeof o.productivityValueCalculation === "string" ? o.productivityValueCalculation : undefined,
    annualCost: typeof o.annualCost === "string" ? o.annualCost : undefined,
    annualCostCalculation: typeof o.annualCostCalculation === "string" ? o.annualCostCalculation : undefined,
    roiMultiple: typeof o.roiMultiple === "string" ? o.roiMultiple : undefined,
    roiMultipleCalculation: typeof o.roiMultipleCalculation === "string" ? o.roiMultipleCalculation : undefined,
    paybackPeriod: typeof o.paybackPeriod === "string" ? o.paybackPeriod : undefined,
    paybackSource: typeof o.paybackSource === "string" ? o.paybackSource : undefined,
    comparisonAlternatives: arr,
  };
}

function sanitizeRiskCategoryBlock(v: unknown): RiskCategoryBlock | undefined {
  if (v == null || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  const risks = Array.isArray(o.risks) ? (o.risks as unknown[]).map((x) => String(x)) : [];
  const mitigations = Array.isArray(o.mitigations) ? (o.mitigations as unknown[]).map((x) => String(x)) : [];
  const level = typeof o.level === "string" ? o.level : undefined;
  return {
    name: typeof o.name === "string" ? o.name : "Risk",
    initialRisk: level,
    level,
    score: typeof o.score === "string" ? o.score : undefined,
    risks,
    mitigations,
    residualRisk: typeof o.residualRisk === "string" ? o.residualRisk : undefined,
  };
}

function sanitizeComplianceAlignment(v: unknown): FullReportJson["complianceAlignment"] {
  if (v == null || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  const requirements = Array.isArray(o.requirements)
    ? (o.requirements as unknown[]).map((x): ComplianceRequirement => {
        const t = x && typeof x === "object" ? (x as Record<string, unknown>) : {};
        const status: ComplianceRequirement["status"] =
          t.status === "Met" || t.status === "Pending" || t.status === "Deferred" ? t.status : "Pending";
        return { name: String(t.name ?? ""), description: String(t.description ?? ""), status };
      })
    : undefined;
  return { summary: typeof o.summary === "string" ? o.summary : undefined, requirements };
}

function sanitizeFrameworkMapping(v: unknown): FullReportJson["frameworkMapping"] {
  if (v == null || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  const rows = Array.isArray(o.rows)
    ? (o.rows as unknown[]).map((x) => {
        const t = x && typeof x === "object" ? (x as Record<string, unknown>) : {};
        return { framework: String(t.framework ?? ""), coverage: String(t.coverage ?? ""), controls: String(t.controls ?? ""), notes: String(t.notes ?? "") };
      })
    : undefined;
  return { rows };
}

function sanitizeImplementationPlan(v: unknown): FullReportJson["implementationPlan"] {
  if (v == null || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  const phases = Array.isArray(o.phases)
    ? (o.phases as unknown[]).map((x): ImplementationPhase => {
        const t = x && typeof x === "object" ? (x as Record<string, unknown>) : {};
        const status: ImplementationPhase["status"] =
          t.status === "Complete" || t.status === "In Progress" || t.status === "Planned" ? t.status : "Planned";
        return {
          title: String(t.title ?? ""),
          timeline: String(t.timeline ?? ""),
          status,
          activities: Array.isArray(t.activities) ? (t.activities as unknown[]).map(String) : [],
          deliverables: Array.isArray(t.deliverables) ? (t.deliverables as unknown[]).map(String) : [],
        };
      })
    : undefined;
  return { phases };
}

function sanitizeAppendix(v: unknown): Appendix | undefined {
  if (v == null || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  const dataSources = Array.isArray(o.dataSources) ? (o.dataSources as unknown[]).map(String) : undefined;
  return {
    methodology: typeof o.methodology === "string" ? o.methodology : undefined,
    preparedBy: typeof o.preparedBy === "string" ? o.preparedBy : undefined,
    reviewedBy: typeof o.reviewedBy === "string" ? o.reviewedBy : undefined,
    confidentiality: typeof o.confidentiality === "string" ? o.confidentiality : undefined,
    dataSources,
  };
}

async function invokeModel(userInput: string): Promise<string> {
  const body = JSON.stringify({
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 8192,
    temperature: 0.3,
    messages: [{ role: "user", content: [{ type: "text", text: userInput }] }],
  });

  const command = new InvokeModelCommand({
    modelId: MODEL_ID,
    contentType: "application/json",
    accept: "application/json",
    body,
  });

  const response = await client.send(command);
  const result = JSON.parse(new TextDecoder().decode(response.body));
  return result.content?.[0]?.text ?? "";
}

/**
 * Generate a structured Analysis Report from vendor COTS assessment data.
 * Called when a vendor user completes (submits) a vendor COTS assessment.
 * Uses risk_mappings table: compares assessment context (domain, timing, intent, primary_risk, secondary_risks)
 * to get top 5 risks, then compares that data to risk_top5_mitigations table to attach mitigations.
 * If top5RisksWithMitigations is not provided, the agent fetches it via getTop5RisksWithMitigations(payload).
 */
export async function generateVendorCotsReport(
  payload: Record<string, unknown>,
  top5RisksWithMitigations?: Top5RisksWithMitigations | null
): Promise<GeneratedVendorCotsReport | null> {
  try {
    let top5: Top5RisksWithMitigations | null = top5RisksWithMitigations ?? null;
    if (top5 == null) {
      top5 = await getTop5RisksWithMitigations(payload);
    }
    const context = buildAssessmentContext(payload, top5);
    const userInput = VENDOR_COTS_REPORT_PROMPT + "\n\n" + context;
    const rawReply = await invokeModel(userInput);
    if (!rawReply.trim()) return null;
    const parsed = parseReportSections(rawReply);
    return { ...parsed, raw: rawReply };
  } catch (err) {
    console.error("generateVendorCotsReport error:", err);
    return null;
  }
}
