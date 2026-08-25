import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import {
  AlertTriangle,
  BarChart2,
  Boxes,
  Briefcase,
  Building2,
  CalendarCheck,
  CheckCircle2,
  CircleChevronLeft,
  Download,
  FileCheck,
  Layers,
  ListChecks,
  PieChart,
  Rocket,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Users2,
  Workflow,
} from "lucide-react";
import LoadingMessage from "../../UI/LoadingMessage";
import {
  AdminLlmModelLabel,
  resolveStoredLlmModelId,
} from "../../UI/AdminLlmModelInfo";
import {
  buildReportPdfFilename,
  downloadElementAsPdf,
  splitAssessmentLabelForPdf,
} from "../../../utils/reportPdfExport";
import { getReportTypeDisplayLabel } from "./reportTypes";
import VendorComparisonMatrixReportBody, {
  parseVendorComparisonMatrixJson,
} from "./VendorComparisonMatrixReportBody";
import ComplianceRiskSummaryReportBody, {
  parseComplianceRiskSummaryJson,
} from "./ComplianceRiskSummaryReportBody";
import ImplementationRiskAssessmentReportBody, {
  parseImplementationRiskAssessmentJson,
} from "./ImplementationRiskAssessmentReportBody";
import MitigationActionPlanReportBody, {
  parseMitigationActionPlanJson,
} from "./MitigationActionPlanReportBody";
import "../UserManagement/user_management.css";
import "../Assessments/assessments.css";
import "./reports.css";
import "./general_reports.css";

const BASE_URL = import.meta.env.VITE_BASE_URL ?? "http://localhost:5003/api/v1";

interface GeneratedReportItem {
  id: string;
  assessmentId: string;
  assessmentLabel: string;
  reportType: string;
  generatedAt: string;
  /** Stored general report body: markdown for most types, or JSON (string or parsed) for Vendor Comparison Matrix. */
  briefContent?: string | Record<string, unknown>;
  llmModelId?: string | null;
  expiryAt?: string | null;
  attestationExpiryAt?: string | null;
  assessmentUserArchivedAt?: string | null;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).replace(/\s+/g, "-");
  } catch {
    return "—";
  }
}

/** Parsed section of the Executive Stakeholder Brief (e.g. "16. 3-sentence business case"). */
interface BriefSection {
  title: string;
  body: string;
}

/** Executive brief + Sales report section: match by number prefix or by heading text so icons apply even if LLM drops numbers. */
const BRIEF_SECTION_DISPLAY: Array<{ pattern: RegExp | string; displayTitle: string; Icon: React.ComponentType<{ size?: number; className?: string }> }> = [
  /* Sales Qualification Report (11–15) – content-only headings from LLM */
  { pattern: /^qualification\s*(?:decision|\+\s*rationale)/i, displayTitle: "Qualification", Icon: CheckCircle2 },
  { pattern: /^qualification\b/i, displayTitle: "Qualification", Icon: CheckCircle2 },
  { pattern: /^score\s+summary\b/i, displayTitle: "Score summary", Icon: BarChart2 },
  { pattern: /^score\s+breakdown\b/i, displayTitle: "Score breakdown", Icon: PieChart },
  { pattern: /^top\s+blockers\b/i, displayTitle: "Top blockers", Icon: AlertTriangle },
  { pattern: /^recommended\s+actions\b/i, displayTitle: "Recommended actions", Icon: ListChecks },
  /* Executive Stakeholder Brief (16–21) – content-only headings from LLM */
  { pattern: /^3-sentence\s+business\s+case\b/i, displayTitle: "Business Use Case", Icon: Briefcase },
  { pattern: /^risk\s+snapshot\b/i, displayTitle: "Risk snapshot", Icon: ShieldAlert },
  { pattern: /^compliance\s+snapshot\b/i, displayTitle: "Compliance snapshot", Icon: FileCheck },
  { pattern: /^deployment\s+approach\b/i, displayTitle: "Deployment approach", Icon: Rocket },
  { pattern: /^roi\/value\s+assumptions\b/i, displayTitle: "ROI/value assumptions", Icon: TrendingUp },
  { pattern: /^decision\s+request\b/i, displayTitle: "Decision request + suggested timeline", Icon: CalendarCheck },
  /* Customer Risk Mitigation Plan (22–27) – content-only headings from LLM */
  { pattern: /^customer\s+context\b/i, displayTitle: "Customer context", Icon: Building2 },
  { pattern: /^top\s+risks\b/i, displayTitle: "Top risks", Icon: ShieldAlert },
  { pattern: /^mitigations\s+per\s+risk\b/i, displayTitle: "Mitigations per risk", Icon: ShieldCheck },
  { pattern: /^ownership\s+matrix\b/i, displayTitle: "Ownership matrix", Icon: Users2 },
  { pattern: /^phasing\b/i, displayTitle: "Phasing", Icon: Layers },
  { pattern: /^validation\s+criteria\s+per\s+mitigation\b|^validation\s+criteria\b/i, displayTitle: "Validation criteria per mitigation", Icon: CheckCircle2 },
  /* Implementation Roadmap Proposal (28–33) – icons match section headings */
  { pattern: /^28\.\s*(.+)?$/i, displayTitle: "Target deployment model + high-level architecture summary", Icon: Boxes },
  { pattern: /^target\s+deployment\s+model\b|high-level\s+architecture\b/i, displayTitle: "Target deployment model + high-level architecture summary", Icon: Boxes },
  { pattern: /^29\.\s*(.+)?$/i, displayTitle: "Phases with goals", Icon: Layers },
  { pattern: /^phases\b|pilot.*production/i, displayTitle: "Phases with goals", Icon: Layers },
  { pattern: /^30\.\s*(.+)?$/i, displayTitle: "Integrations & data flow", Icon: Workflow },
  { pattern: /^integrations\s+checklist\b|data\s+flow\b/i, displayTitle: "Integrations & data flow", Icon: Workflow },
  { pattern: /^31\.\s*(.+)?$/i, displayTitle: "Resources", Icon: Users2 },
  { pattern: /^resources\b|vendor.*customer\s+roles\b/i, displayTitle: "Resources", Icon: Users2 },
  { pattern: /^32\.\s*(.+)?$/i, displayTitle: "Risk gates", Icon: ShieldCheck },
  { pattern: /^risk\s+gates\b/i, displayTitle: "Risk gates", Icon: ShieldCheck },
  { pattern: /^33\.\s*(.+)?$/i, displayTitle: "Timeline", Icon: CalendarCheck },
  { pattern: /^timeline\s+estimate\b|assumptions\b/i, displayTitle: "Timeline", Icon: CalendarCheck },
];

/** Strip leading "1." "2." "11." etc. from section heading text. */
function stripSectionNumber(title: string): string {
  return title.replace(/^#{1,6}\s+/, "").replace(/^\s*\d+\.\s*/, "").trim() || title;
}

function getBriefSectionDisplay(title: string): { displayTitle: string; Icon: React.ComponentType<{ size?: number; className?: string }> } {
  const trimmed = title.trim();
  /** Also match with leading "N. " stripped so "1. Qualification..." matches content patterns. */
  const titleNoNumber = stripSectionNumber(trimmed) || trimmed;
  for (const { pattern, displayTitle, Icon } of BRIEF_SECTION_DISPLAY) {
    const matched =
      typeof pattern === "string"
        ? trimmed === pattern || titleNoNumber === pattern
        : pattern.test(trimmed) || pattern.test(titleNoNumber);
    if (matched) return { displayTitle, Icon };
  }
  return { displayTitle: titleNoNumber || trimmed, Icon: FileCheck };
}

/** Parse brief content into sections by markdown headings (#–######). */
function parseBriefContent(briefContent: string): BriefSection[] {
  const sections: BriefSection[] = [];
  const lines = briefContent.split(/\r?\n/);
  let currentTitle = "";
  let currentBody: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^#{1,6}\s+(.+)$/);
    if (headingMatch) {
      if (currentTitle) {
        sections.push({
          title: currentTitle,
          body: currentBody.join("\n").trim(),
        });
      }
      currentTitle = stripMarkdownArtifacts(headingMatch[1]);
      currentBody = [];
    } else {
      currentBody.push(line);
    }
  }
  if (currentTitle) {
    sections.push({
      title: currentTitle,
      body: currentBody.join("\n").trim(),
    });
  }
  return sections.length > 0 ? sections : [{ title: "Brief", body: briefContent }];
}

/** Remove markdown markers (*, **, #, ---) so they are not shown in the UI. */
function stripMarkdownArtifacts(s: string): string {
  return String(s ?? "")
    .replace(/\*\*([^*]*)\*\*/g, "$1")
    .replace(/\*([^*]*)\*/g, "$1")
    .replace(/__([^_]*)__/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/(^|\s)#{1,6}(?=\s|$)/g, "$1")
    .replace(/#{2,}/g, "")
    .replace(/^[ \t]*-{3,}[ \t]*$/gm, "")
    .replace(/\s*-{3,}\s*/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** Remove "[Assumption]" from executive brief body text for display. */
function stripAssumptionLabel(text: string): string {
  return text.replace(/\s*\[Assumption\]\s*/gi, " ").replace(/\s*\[assumption\]\s*/gi, " ").trim();
}

/** Remove leading "1. " "2. " etc. from Sales Qualification Report body lines. */
function stripNumberedPrefix(text: string): string {
  return text.replace(/^\s*\d+\.\s*/, "").trim();
}

function isTopBlockersSectionTitle(title: string): boolean {
  return /^top\s+blockers\b/i.test(stripSectionNumber(title));
}

function isTopRisksSectionTitle(title: string): boolean {
  return /^top\s+risks\b/i.test(stripSectionNumber(title));
}

function isOwnershipMatrixSectionTitle(title: string): boolean {
  return /^ownership\s+matrix\b/i.test(stripSectionNumber(title));
}

function isMarkdownTableRow(line: string): boolean {
  const t = line.trim();
  return t.startsWith("|") && t.includes("|", 1);
}

function isMarkdownTableSeparator(line: string): boolean {
  return /^\|?[\s:\-|]+$/.test(line.trim()) && /-{3,}/.test(line);
}

function splitMarkdownTableCells(line: string): string[] {
  let t = line.trim();
  if (t.startsWith("|")) t = t.slice(1);
  if (t.endsWith("|")) t = t.slice(0, -1);
  return t.split("|").map((c) => stripMarkdownArtifacts(c));
}

type OwnershipMatrixRow = { item: string; ownership: string; notes: string };

function parseOwnershipBulletRow(line: string): OwnershipMatrixRow | null {
  const raw = line.trim().replace(/^\s*[-*]\s+/, "");
  if (!raw || isMarkdownTableRow(raw) || isMarkdownTableSeparator(raw)) return null;
  const cleaned = stripMarkdownArtifacts(raw);
  if (!cleaned) return null;

  const colonIdx = cleaned.indexOf(":");
  if (colonIdx === -1) {
    return { item: cleaned, ownership: "", notes: "" };
  }

  const item = cleaned.slice(0, colonIdx).trim();
  let rest = cleaned.slice(colonIdx + 1).trim();
  if (!item) return null;

  const ownershipMatch = rest.match(
    /^(Vendor|Buyer|Shared|To be confirmed)(?:\s*\/\s*(?:Vendor|Buyer|Shared))*/i,
  );
  if (ownershipMatch) {
    const ownership = ownershipMatch[0].trim();
    const notes = rest.slice(ownershipMatch[0].length).trim().replace(/^[–—-]\s*/, "").trim();
    return { item, ownership, notes: stripMarkdownArtifacts(notes) };
  }

  const dashParts = rest.split(/\s*[–—]\s+|\s+-\s+/);
  if (dashParts.length >= 2) {
    return {
      item,
      ownership: stripMarkdownArtifacts(dashParts[0]),
      notes: stripMarkdownArtifacts(dashParts.slice(1).join(" – ")),
    };
  }

  return { item, ownership: stripMarkdownArtifacts(rest), notes: "" };
}

function parseOwnershipMatrixRows(body: string): OwnershipMatrixRow[] {
  const lines = body.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const mdLines = lines.filter((l) => isMarkdownTableRow(l) || isMarkdownTableSeparator(l));

  if (mdLines.filter(isMarkdownTableRow).length >= 2) {
    const cellRows = mdLines
      .filter((l) => !isMarkdownTableSeparator(l))
      .map(splitMarkdownTableCells)
      .filter((cells) => cells.some((c) => c.length > 0));

    if (cellRows.length > 0) {
      const header = cellRows[0].map((h) => h.toLowerCase());
      const looksLikeHeader =
        header.some((h) => /ownership|owner|vendor|buyer|shared|risk|mitigation|item|note/i.test(h));
      const dataRows = looksLikeHeader ? cellRows.slice(1) : cellRows;

      return dataRows.map((cells) => {
        if (cells.length >= 3) {
          return { item: cells[0] || "", ownership: cells[1] || "", notes: cells.slice(2).join(" | ") };
        }
        if (cells.length === 2) {
          return { item: cells[0] || "", ownership: cells[1] || "", notes: "" };
        }
        return { item: cells[0] || "", ownership: "", notes: "" };
      });
    }
  }

  return lines
    .map(parseOwnershipBulletRow)
    .filter((row): row is OwnershipMatrixRow => row != null && Boolean(row.item));
}

function renderOwnershipMatrixTable(body: string, sectionKey: string): React.ReactNode {
  const rows = parseOwnershipMatrixRows(body);
  if (rows.length === 0) {
    return (
      <p className="report_exec_brief_para">
        {stripMarkdownArtifacts(body) || "Not specified"}
      </p>
    );
  }

  return (
    <div
      className="report_table_wrap report_ownership_matrix_wrap"
      role="region"
      aria-label="Ownership matrix"
    >
      <table className="report_table report_ownership_matrix_table">
        <thead>
          <tr>
            <th scope="col">Risk / Mitigation</th>
            <th scope="col">Ownership</th>
            <th scope="col">Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={`${sectionKey}-own-${i}`}>
              <td>{stripMarkdownArtifacts(row.item)}</td>
              <td>
                {row.ownership ? (
                  <span className="report_ownership_badge">
                    {stripMarkdownArtifacts(row.ownership)}
                  </span>
                ) : (
                  "—"
                )}
              </td>
              <td>{stripMarkdownArtifacts(row.notes) || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function severityClassName(sev: string): string {
  const s = String(sev ?? "").trim().toLowerCase();
  if (s.startsWith("high")) return "report_severity_high";
  if (s.startsWith("medium")) return "report_severity_medium";
  if (s.startsWith("low")) return "report_severity_low";
  return "report_severity_unknown";
}

function parseTopBlockerLine(
  line: string,
): { main: string; severity?: string; likelihood?: string; impact?: string; evidence?: string } {
  const bulletless = stripMarkdownArtifacts(
    stripAssumptionLabel(line.trim().replace(/^\s*[-*]\s+/, "")),
  );
  const severityMatch = bulletless.match(/(?:^|\s)Severity:\s*([^|]+?)(?=\s+[|–—-]\s+(?:Likelihood:|Impact:|Evidence:)|\s+Evidence:|$)/i);
  const likelihoodMatch = bulletless.match(/(?:^|\s)Likelihood:\s*([^|–—-]+?)(?=\s+[|–—-]\s+Impact:|\s+Evidence:|$)/i);
  const impactMatch = bulletless.match(/(?:^|\s)Impact:\s*([^|]+?)(?=\s+[|–—-]\s+Severity:|\s+Evidence:|$)/i);
  const evidenceMatch = bulletless.match(/(?:^|\s)Evidence:\s*(.+)$/i);
  const severity = severityMatch?.[1]?.trim().replace(/\s*[|–—-]\s*$/, "");
  const likelihood = likelihoodMatch?.[1]?.trim().replace(/\s*[|–—-]\s*$/, "");
  const impact = impactMatch?.[1]?.trim().replace(/\s*[|–—-]\s*$/, "");
  const evidence = evidenceMatch?.[1]?.trim();

  let main = bulletless;
  main = main.replace(/\s*Severity:\s*[^|]+?(?=\s+Evidence:|$)/i, "").trim();
  main = main.replace(/\s*[|–—-]\s*Severity:\s*[^|]+?(?=\s+Evidence:|$)/i, "").trim();
  main = main.replace(/\s*Likelihood:\s*[^|–—-]+?(?=\s+[|–—-]\s+Impact:|\s+Evidence:|$)/i, "").trim();
  main = main.replace(/\s*[|–—-]\s*Impact:\s*[^|]+?(?=\s+Evidence:|$)/i, "").trim();
  main = main.replace(/\s*Impact:\s*[^|]+?(?=\s+Evidence:|$)/i, "").trim();
  main = main.replace(/\s*[|–—-]\s*Severity:\s*[^|]+?(?=\s+Evidence:|$)/i, "").trim();
  main = main.replace(/\s*Evidence:\s*.+$/i, "").trim();
  main = main.replace(/\s*[|–—-]\s*$/, "").trim();
  return { main: main || bulletless, severity, likelihood, impact, evidence };
}

/** Render a line of body: support bold labels and bullet lines; strip leftover markdown. */
function renderBriefLine(
  line: string,
  key: string,
  stripNumbers = false,
  sectionTitle = "",
): React.ReactNode {
  const trimmed = line.trim();
  if (!trimmed) return null;
  // Skip markdown horizontal rules (---, ***, ___)
  if (/^(-{3,}|\*{3,}|_{3,}|#{3,})$/.test(trimmed)) return null;
  // Skip leftover heading-only markers
  if (/^#{1,6}$/.test(trimmed)) return null;
  const bullet = /^\s*[-*]\s+/.test(line);
  if (bullet && (isTopBlockersSectionTitle(sectionTitle) || isTopRisksSectionTitle(sectionTitle))) {
    const { main, severity, likelihood, impact, evidence } = parseTopBlockerLine(line);
    const isBlocker = isTopBlockersSectionTitle(sectionTitle);
    const labelRegex = isBlocker ? /^blocker:\s*/i : /^risk:\s*/i;
    const prefixMatch = main.match(labelRegex);
    const label = prefixMatch?.[0]?.trim() ?? "";
    const body = prefixMatch ? main.slice(prefixMatch[0].length).trim() : main;
    return (
      <li key={key} className="report_exec_brief_bullet report_blocker_item report_risk_like_item">
        <div className="report_blocker_main">
          {prefixMatch ? (
            <>
              <strong>{label}</strong>{body ? ` ${body}` : ""}
            </>
          ) : (
            main
          )}
        </div>
        {(severity || likelihood || impact || evidence) ? (
          <div className="report_blocker_meta">
            {severity ? (
              <span className="report_blocker_metric">
                Severity: <span className={`report_blocker_metric_value ${severityClassName(severity)}`}>{severity}</span>
              </span>
            ) : null}
            {likelihood ? (
              <span className="report_blocker_metric">
                Likelihood: <span className={`report_blocker_metric_value ${severityClassName(likelihood)}`}>{likelihood}</span>
              </span>
            ) : null}
            {impact ? (
              <span className="report_blocker_metric">
                Impact: <span className={`report_blocker_metric_value ${severityClassName(impact)}`}>{impact}</span>
              </span>
            ) : null}
            {evidence ? (
              <span className="report_blocker_evidence">Evidence: {evidence}</span>
            ) : null}
          </div>
        ) : null}
      </li>
    );
  }
  const parts: React.ReactNode[] = [];
  let remaining = trimmed.replace(/^\s*[-*]\s+/, "");
  remaining = stripAssumptionLabel(remaining);
  if (stripNumbers) remaining = stripNumberedPrefix(remaining);
  // Drop leading heading hashes that leaked into body lines
  remaining = remaining.replace(/^#{1,6}\s+/, "").trim();
  // Remove leftover markdown horizontal rules from the line
  remaining = remaining.replace(/\s*-{3,}\s*/g, " ").trim();
  if (!remaining) return null;
  const boldRegex = /\*\*([^*]+)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = boldRegex.exec(remaining)) !== null) {
    if (match.index > lastIndex) {
      parts.push(stripMarkdownArtifacts(remaining.slice(lastIndex, match.index)));
    }
    parts.push(
      <strong key={`${key}-b-${match.index}`}>
        {stripMarkdownArtifacts(match[1])}
      </strong>,
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < remaining.length) {
    parts.push(stripMarkdownArtifacts(remaining.slice(lastIndex)));
  }
  const content = parts.length > 0 ? parts : stripMarkdownArtifacts(remaining);
  if (!content || (typeof content === "string" && !content.trim())) return null;
  if (bullet) {
    return <li key={key} className="report_exec_brief_bullet">{content}</li>;
  }
  return <p key={key} className="report_exec_brief_para">{content}</p>;
}

function renderBriefBody(
  body: string,
  sectionKey: string,
  stripNumbers = false,
  sectionTitle = "",
): React.ReactNode {
  if (isOwnershipMatrixSectionTitle(sectionTitle)) {
    return renderOwnershipMatrixTable(body, sectionKey);
  }

  const lines = body.split(/\r?\n/).filter((l) => l.trim() !== "" || l.includes("\n"));
  const items: React.ReactNode[] = [];
  const listItems: React.ReactNode[] = [];
  let inList = false;

  lines.forEach((line, i) => {
    const key = `${sectionKey}-${i}`;
    const isBullet = /^\s*[-*]\s+/.test(line);
    if (isBullet) {
      if (!inList && listItems.length > 0) {
        const listClass = (isTopBlockersSectionTitle(sectionTitle) || isTopRisksSectionTitle(sectionTitle))
          ? "report_exec_brief_list report_blocker_list"
          : "report_exec_brief_list";
        items.push(<ul key={`${key}-ul`} className={listClass}>{listItems.slice()}</ul>);
        listItems.length = 0;
      }
      inList = true;
      listItems.push(renderBriefLine(line, key, stripNumbers, sectionTitle));
    } else {
      if (inList && listItems.length > 0) {
        const listClass = (isTopBlockersSectionTitle(sectionTitle) || isTopRisksSectionTitle(sectionTitle))
          ? "report_exec_brief_list report_blocker_list"
          : "report_exec_brief_list";
        items.push(<ul key={`${key}-ul`} className={listClass}>{listItems.slice()}</ul>);
        listItems.length = 0;
        inList = false;
      }
      const node = renderBriefLine(line, key, stripNumbers, sectionTitle);
      if (node) items.push(node);
    }
  });
  if (listItems.length > 0) {
    const listClass = (isTopBlockersSectionTitle(sectionTitle) || isTopRisksSectionTitle(sectionTitle))
      ? "report_exec_brief_list report_blocker_list"
      : "report_exec_brief_list";
    items.push(<ul key={`${sectionKey}-ul-end`} className={listClass}>{listItems.slice()}</ul>);
  }
  return items.length > 0 ? <>{items}</> : <p className="report_exec_brief_para">{stripMarkdownArtifacts(body)}</p>;
}

const LOADER_MIN_MS = 2500;

function isSystemUserRole(): boolean {
  const role = (sessionStorage.getItem("systemRole") ?? "").toLowerCase().trim().replace(/_/g, " ");
  return role === "system admin" || role === "system manager" || role === "system viewer";
}

function generalReportTabTitle(report: Pick<GeneratedReportItem, "assessmentLabel" | "reportType">): string {
  const typeLabel = getReportTypeDisplayLabel(String(report.reportType ?? "").trim());
  return typeLabel || "Report";
}

function GeneralReportDetail() {
  const { reportId } = useParams<{ reportId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const reportTitleFromNavState =
    ((location.state as { reportTitle?: string } | null)?.reportTitle ?? "").trim();
  const cachedTitleKey = reportId ? `generalReportTitle:${reportId}` : "";
  const cachedReportTitle =
    cachedTitleKey ? (sessionStorage.getItem(cachedTitleKey) ?? "").trim() : "";
  const showDownload = !isSystemUserRole();
  const [report, setReport] = useState<GeneratedReportItem | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const pdfBodyRef = useRef<HTMLDivElement>(null);
  const [pdfExporting, setPdfExporting] = useState(false);

  useEffect(() => {
    const id = reportId?.trim();
    if (!id) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    const token = sessionStorage.getItem("bearerToken");
    if (!token) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    const loadStart = Date.now();
    const finishLoading = () => {
      const elapsed = Date.now() - loadStart;
      const remaining = Math.max(0, LOADER_MIN_MS - elapsed);
      setTimeout(() => setLoading(false), remaining);
    };
    fetch(`${BASE_URL}/generalReports/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) {
          setReport(null);
          setNotFound(true);
          finishLoading();
          return;
        }
        return res.json();
      })
      .then((data) => {
        if (data?.success && data?.data) {
          const d = data.data;
          setReport({
            id: d.id,
            assessmentId: d.assessmentId,
            assessmentLabel: d.assessmentLabel ?? "",
            reportType: d.reportType,
            generatedAt: d.generatedAt,
            briefContent: d.briefContent,
            llmModelId: d.llmModelId ?? null,
            expiryAt: d.expiryAt ?? null,
            attestationExpiryAt: d.attestationExpiryAt ?? null,
            assessmentUserArchivedAt: d.assessmentUserArchivedAt ?? null,
          });
          setNotFound(false);
        } else {
          setReport(null);
          setNotFound(true);
        }
        finishLoading();
      })
      .catch(() => {
        setReport(null);
        setNotFound(true);
        finishLoading();
      });
  }, [reportId]);

  useEffect(() => {
    if (loading) {
      const loadingTitle = cachedReportTitle || "Report";
      document.title = `AI-Q | ${loadingTitle}`;
      return () => { document.title = "AI-Q"; };
    }
    if (notFound || !report) {
      document.title = "AI-Q | Report not found";
      return () => { document.title = "AI-Q"; };
    }
    const resolvedTitle = generalReportTabTitle(report);
    document.title = `AI-Q | ${resolvedTitle}`;
    if (cachedTitleKey) {
      sessionStorage.setItem(cachedTitleKey, resolvedTitle);
    }
    return () => { document.title = "AI-Q"; };
  }, [loading, notFound, report, reportTitleFromNavState, cachedReportTitle, cachedTitleKey]);

  const handleBack = (e: React.MouseEvent) => {
    e.preventDefault();
    navigate("/reports", { state: { tab: "general" } });
  };

  const handleExportPdf = useCallback(async () => {
    if (!report || !pdfBodyRef.current) return;
    const reportTypeLabel = getReportTypeDisplayLabel(report.reportType);
    const split = splitAssessmentLabelForPdf(report.assessmentLabel);
    let orgName = split.org;
    let productName = split.product;
    if (report.reportType === "Vendor Comparison Matrix") {
      const vcm = parseVendorComparisonMatrixJson(report.briefContent);
      if (!productName) productName = String(vcm?.productName ?? "").trim();
      if (!orgName) orgName = String(vcm?.vendorName ?? "").trim();
    }
    if (!orgName) orgName = report.assessmentLabel.trim() || "Assessment";
    if (!productName) productName = "Product";
    const filename = buildReportPdfFilename({
      reportName: reportTypeLabel || "General-Report",
      orgName,
      productName,
    });
    try {
      setPdfExporting(true);
      await downloadElementAsPdf(pdfBodyRef.current, filename);
    } catch (err) {
      console.error(err);
      toast.error("Could not export PDF. Try again in a moment.");
    } finally {
      setPdfExporting(false);
    }
  }, [report]);

  if (loading) {
    return (
      <div className="sec_user_page org_settings_page reports_page report_detail_page report_detail_type_general">
        <LoadingMessage message="Loading report…" className="loading_message_wrapper--page" />
      </div>
    );
  }

  if (notFound || !report) {
    return (
      <div className="sec_user_page org_settings_page reports_page report_detail_page report_detail_type_general">
        <div className="report_detail_empty">
          <h2 className="report_detail_empty_title">Report not found</h2>
          <p className="report_detail_empty_text">
            This report does not exist or may have been cleared. Return to the
            Reports Library to generate a new report.
          </p>
          <a
            href="/reports"
            className="report_assessment_back report_detail_empty_back"
            onClick={(e) => {
              e.preventDefault();
              navigate("/reports", { state: { tab: "general" } });
            }}
          >
            <CircleChevronLeft size={20} />
            Back to Reports
          </a>
        </div>
      </div>
    );
  }

  const generatedDate = formatDate(report.generatedAt);

  const isAssessmentExpired =
    report.expiryAt != null &&
    String(report.expiryAt).trim() !== "" &&
    !Number.isNaN(new Date(report.expiryAt).getTime()) &&
    new Date(report.expiryAt).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0);
  const isAttestationExpired =
    report.attestationExpiryAt != null &&
    String(report.attestationExpiryAt).trim() !== "" &&
    !Number.isNaN(new Date(report.attestationExpiryAt).getTime()) &&
    new Date(report.attestationExpiryAt).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0);
  const isUserAssessArchived =
    report.assessmentUserArchivedAt != null &&
    String(report.assessmentUserArchivedAt).trim() !== "";
  const isArchived = isUserAssessArchived || isAssessmentExpired || isAttestationExpired;

  const vendorComparisonMatrixData =
    report.reportType === "Vendor Comparison Matrix"
      ? parseVendorComparisonMatrixJson(report.briefContent)
      : null;
  const isVendorComparisonMatrixReport = report.reportType === "Vendor Comparison Matrix";

  const complianceRiskSummaryData =
    report.reportType === "Compliance & Risk Summary"
      ? parseComplianceRiskSummaryJson(report.briefContent)
      : null;

  const implementationRiskAssessmentData =
    report.reportType === "Implementation Risk Assessment"
      ? parseImplementationRiskAssessmentJson(report.briefContent)
      : null;

  const mitigationActionPlanData =
    report.reportType === "Mitigation Action Plan"
      ? parseMitigationActionPlanJson(report.briefContent)
      : null;

  return (
    <div
      className={`sec_user_page org_settings_page reports_page report_detail_page report_detail_full report_detail_type_general${
        isVendorComparisonMatrixReport ? " report_detail_type_vcm" : ""
      }`}
    >
      <header className="report_assessment_header">
        <div className="report_assessment_title_row report_assessment_actions_row">
          <a
            href="/reports"
            className="report_assessment_back"
            onClick={handleBack}
          >
            <CircleChevronLeft size={20} />
            Back to Reports
          </a>
          {!isArchived && showDownload && (
            <button
              type="button"
              className="report_detail_export_btn"
              onClick={() => void handleExportPdf()}
              disabled={pdfExporting}
              aria-busy={pdfExporting}
              aria-label="Export PDF"
            >
              <Download size={18} aria-hidden />
              {pdfExporting ? "Exporting…" : "Export PDF"}
            </button>
          )}
        </div>
        {isArchived ? (
          <div
            className="report_framework_notice report_framework_notice_warn report_framework_notice_page"
            role="status"
          >
            <AlertTriangle
              size={18}
              className="report_framework_notice_icon"
              aria-hidden
            />
            <p className="report_framework_notice_text">
              This assessment is archived; this report snapshot is read-only.
            </p>
          </div>
        ) : null}
      </header>

      <div ref={pdfBodyRef} className="report_detail_body_shell">
        <header className="report_assessment_doc_header report_assessment_doc_header--with_llm">
          <div className="report_assessment_doc_header_main">
            <h1 className="report_assessment_title">{getReportTypeDisplayLabel(report.reportType)}</h1>
            <p className="report_assessment_subtitle">
              {report.assessmentLabel} • {generatedDate}
            </p>
          </div>
          <AdminLlmModelLabel
            className="report_llm_model_tag"
            showIcon={false}
            preferModelId
            fallbackToActive
            modelName={resolveStoredLlmModelId({
              llmModelId: report.llmModelId,
              report:
                typeof report.briefContent === "object" && report.briefContent != null
                  ? report.briefContent
                  : (() => {
                      if (typeof report.briefContent !== "string") return null;
                      const t = report.briefContent.trim();
                      if (!t.startsWith("{")) return null;
                      try {
                        return JSON.parse(t) as Record<string, unknown>;
                      } catch {
                        return null;
                      }
                    })(),
            })}
          />
        </header>

        <div className="report_context_panel general_report_meta_panel">
          <div className="report_context_panel_top">
            <span className="report_context_pill">
              {getReportTypeDisplayLabel(report.reportType)}
            </span>
            {isArchived ? (
              isAssessmentExpired || isAttestationExpired ? (
                <span className="pill pill_status pill_status_inactive pill_status_with_dot">
                  <span className="pill_status_dot" aria-hidden />
                  Expired
                </span>
              ) : (
                <span className="assessments_vd_badge assessments_vd_badge--archived">
                  Archived
                </span>
              )
            ) : (
              <span className="pill pill_status pill_status_active pill_status_with_dot">
                <span className="pill_status_dot" aria-hidden />
                Completed
              </span>
            )}
          </div>
          <dl className="general_report_meta_grid">
            <div className="general_report_meta_item">
              <dt>Assessment</dt>
              <dd>{report.assessmentLabel}</dd>
            </div>
            <div className="general_report_meta_item">
              <dt>Generated</dt>
              <dd>{generatedDate}</dd>
            </div>
          </dl>
        </div>

        <section className="general_report_detail_body">
        {implementationRiskAssessmentData ? (
          <div className="report_summary_body">
            <ImplementationRiskAssessmentReportBody data={implementationRiskAssessmentData} />
          </div>
        ) : report.reportType === "Implementation Risk Assessment" ? (
          <p className="report_summary_body">
            Implementation Risk Assessment data is missing or could not be read. Try generating the report
            again from Assessment Analysis.
          </p>
        ) : mitigationActionPlanData ? (
          <div className="report_summary_body">
            <MitigationActionPlanReportBody data={mitigationActionPlanData} />
          </div>
        ) : report.reportType === "Mitigation Action Plan" ? (
          <p className="report_summary_body">
            Mitigation Action Plan data is missing or could not be read. Try generating the report again from
            Assessment Analysis.
          </p>
        ) : complianceRiskSummaryData ? (
          <div className="report_summary_body">
            <ComplianceRiskSummaryReportBody data={complianceRiskSummaryData} />
          </div>
        ) : report.reportType === "Compliance & Risk Summary" ? (
          <p className="report_summary_body">
            Compliance &amp; Risk Summary data is missing or could not be read. Try generating the report
            again from Assessment Analysis.
          </p>
        ) : vendorComparisonMatrixData ? (
          <div className="report_summary_body">
            <VendorComparisonMatrixReportBody data={vendorComparisonMatrixData} />
          </div>
        ) : report.reportType === "Vendor Comparison Matrix" ? (
          <p className="report_summary_body">
            Vendor Comparison Matrix data is missing or could not be read. Try generating the report
            again from Assessment Analysis.
          </p>
        ) : typeof report.briefContent === "string" && report.briefContent.trim() !== "" ? (
          <div className="report_summary_body report_exec_brief_body">
            {parseBriefContent(report.briefContent).map((section, idx) => {
              const { displayTitle, Icon } = getBriefSectionDisplay(section.title);
              return (
                <div key={idx} className="report_exec_brief_section report_section_card">
                  <h3 className="report_exec_brief_section_title">
                    <Icon size={20} className="report_exec_brief_section_icon" aria-hidden />
                    {displayTitle}
                  </h3>
                  <div className="report_exec_brief_section_body">
                    {renderBriefBody(
                      section.body,
                      `sec-${idx}`,
                      report.reportType === "Sales Qualification Report" ||
                        report.reportType === "Qualification" ||
                        report.reportType === "Customer Risk Mitigation Plan" ||
                        report.reportType === "Implementation Roadmap Proposal",
                      section.title,
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="report_summary_body">
            This assessment analysis report has no content yet. Generate the report again from the
            Assessment Analysis tab in the Reports Library.
          </p>
        )}
        </section>
      </div>
    </div>
  );
}

export default GeneralReportDetail;
