import { ShieldAlert } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import HeaderEachPage from "../../UI/HeaderEachPage";
import Select from "../../UI/Select";

const BASE_URL = import.meta.env.VITE_BASE_URL ?? "http://localhost:5003/api/v1";

type AssessmentRow = {
  assessmentId: number | string;
  status?: string | null;
  type?: string | null;
  expiryAt?: string | null;
  customerOrganizationName?: string | null;
  product_in_scope?: string | null;
  productInScope?: string | null;
  vendorName?: string | null;
  productName?: string | null;
};

type RiskTab = "risk_register" | "framework_mappings" | "gap_analysis";

type AssessmentDetail = {
  assessmentId?: string | number;
  assessmentLabel?: string;
  vendorName?: string;
  productName?: string;
  identifiedRisks?: unknown;
  riskMitigation?: unknown;
  riskDomainScores?: unknown;
  updatedAt?: string;
};

type RiskItem = {
  id: string;
  severity: "low" | "medium" | "critical/high";
  status: "open" | "mitigated";
  title: string;
  description: string;
  owner: string;
  progressPercent: number;
  date: string;
};

type CompleteReportRiskDomain = {
  domain?: string;
  riskScore?: number;
  summary?: string;
  riskScope?: "vendor" | "buyer" | "both";
};

type DbMatchedRisk = {
  risk_mapping_id?: number;
  risk_id?: string | null;
  risk_title?: string | null;
  description?: string | null;
};

type DbMitigation = {
  mitigation_action_name?: string;
  mitigation_definition?: string | null;
  mitigation_category?: string;
};

function isAssessmentExpired(row: AssessmentRow): boolean {
  const expiryAt = row.expiryAt;
  if (expiryAt == null || String(expiryAt).trim() === "") return false;
  const expiry = new Date(expiryAt);
  if (Number.isNaN(expiry.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expiry.setHours(0, 0, 0, 0);
  return expiry.getTime() < today.getTime();
}

function getAssessmentLabel(a: AssessmentRow): string {
  const org = (a.customerOrganizationName ?? "").toString().trim();
  const productInScope = (a.product_in_scope ?? a.productInScope ?? "").toString().trim();
  if (org && productInScope) return `${org} and ${productInScope}`;
  if (org) return org;
  if (productInScope) return productInScope;
  const product = (a.productName ?? "").toString().trim();
  const vendor = (a.vendorName ?? "").toString().trim();
  if (product && vendor) return `${product} - ${vendor}`;
  if (product) return product;
  if (vendor) return vendor;
  return `Assessment #${String(a.assessmentId)}`;
}

function parseList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((x) => String(x).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    const s = value.trim();
    if (!s) return [];
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed.map((x) => String(x).trim()).filter(Boolean);
    } catch {
      // Ignore parse errors and use delimiter-based split fallback.
    }
    return s
      .split(/\r?\n|;|,/)
      .map((x) => x.trim())
      .filter(Boolean);
  }
  return [];
}

function severityFromDomainScores(raw: unknown, idx: number): RiskItem["severity"] {
  const values = parseList(raw);
  const maybeNum = Number(values[idx]?.match(/\d+(\.\d+)?/)?.[0] ?? "");
  if (Number.isFinite(maybeNum)) {
    if (maybeNum >= 8) return "critical/high";
    if (maybeNum >= 5) return "medium";
    return "low";
  }
  return idx % 3 === 0 ? "critical/high" : idx % 3 === 1 ? "medium" : "low";
}

function toDateLabel(iso: string | undefined): string {
  if (!iso) return new Date().toISOString().slice(0, 10);
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function buildRiskItems(
  detail: AssessmentDetail | null,
  completeReportRiskAnalysis: CompleteReportRiskDomain[],
  dbTop5Risks: DbMatchedRisk[],
  dbMitigationsByRiskId: Record<string, DbMitigation[]>,
): RiskItem[] {
  if (completeReportRiskAnalysis.length > 0) {
    const today = toDateLabel(undefined);
    return completeReportRiskAnalysis.map((risk, idx) => {
      const score = Number(risk.riskScore ?? 0);
      const severity: RiskItem["severity"] =
        score >= 7 ? "critical/high" : score >= 4 ? "medium" : "low";
      return {
        id: `RA${String(idx + 1).padStart(3, "0")}`,
        severity,
        status: score <= 3 ? "mitigated" : "open",
        title: String(risk.domain ?? `Risk Domain ${idx + 1}`),
        description: String(risk.summary ?? "No summary available."),
        owner: "Risk Team",
        progressPercent: score <= 3 ? 100 : score <= 5 ? 75 : 50,
        date: today,
      };
    });
  }
  if (dbTop5Risks.length > 0) {
    const today = toDateLabel(undefined);
    return dbTop5Risks.map((risk, idx) => {
      const rid = String(risk.risk_id ?? "").trim();
      const mitigations = rid ? dbMitigationsByRiskId[rid] ?? [] : [];
      const mitigationText =
        mitigations.length > 0
          ? mitigations
              .map((m) => {
                const name = String(m.mitigation_action_name ?? "").trim();
                const def = String(m.mitigation_definition ?? "").trim();
                return `${name}${def ? ` - ${def}` : ""}`.trim();
              })
              .filter(Boolean)
              .join("; ")
          : "Mitigation action pending refinement.";
      const mitigated = mitigations.length > 0;
      return {
        id: rid || `AI${String(idx + 1).padStart(3, "0")}`,
        severity: severityFromDomainScores(detail?.riskDomainScores, idx),
        status: mitigated ? "mitigated" : "open",
        title: String(risk.risk_title ?? `Risk ${idx + 1}`).trim(),
        description: String(risk.description ?? mitigationText).trim() || mitigationText,
        owner: "Risk Team",
        progressPercent: mitigated ? 75 : 50,
        date: today,
      };
    });
  }
  if (!detail) return [];
  const identified = parseList(detail.identifiedRisks);
  const mitigations = parseList(detail.riskMitigation);
  const date = toDateLabel(detail.updatedAt);
  return identified.map((title, idx) => {
    const mitigation = mitigations[idx] ?? "Mitigation action pending refinement.";
    const mitigated = /complete|closed|done|mitigated/i.test(mitigation);
    return {
      id: `AI${String(idx + 1).padStart(3, "0")}`,
      severity: severityFromDomainScores(detail.riskDomainScores, idx),
      status: mitigated ? "mitigated" : "open",
      title,
      description: mitigation,
      owner: "Risk Team",
      progressPercent: mitigated ? 100 : 50,
      date,
    };
  });
}

const MyVendors = () => {
  const [assessments, setAssessments] = useState<AssessmentRow[]>([]);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState("");
  const [activeTab, setActiveTab] = useState<RiskTab>("risk_register");
  const [assessmentDetail, setAssessmentDetail] = useState<AssessmentDetail | null>(null);
  const [completeReportRiskAnalysis, setCompleteReportRiskAnalysis] = useState<CompleteReportRiskDomain[]>([]);
  const [dbTop5Risks, setDbTop5Risks] = useState<DbMatchedRisk[]>([]);
  const [dbMitigationsByRiskId, setDbMitigationsByRiskId] = useState<Record<string, DbMitigation[]>>({});

  const completedActiveAssessmentOptions = useMemo(() => {
    const rows = assessments.filter((a) => {
      const status = String(a.status ?? "").toLowerCase().trim();
      const type = String(a.type ?? "").toLowerCase().trim();
      return type === "cots_buyer" && status !== "draft" && !isAssessmentExpired(a);
    });
    return rows.map((a) => ({
      value: String(a.assessmentId),
      label: getAssessmentLabel(a),
    }));
  }, [assessments]);

  useEffect(() => {
    const token = sessionStorage.getItem("bearerToken");
    if (!token) return;
    fetch(`${BASE_URL}/assessments?all=1`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const list = Array.isArray(data?.data?.assessments) ? (data.data.assessments as AssessmentRow[]) : [];
        setAssessments(list);
      })
      .catch(() => setAssessments([]));
  }, []);

  useEffect(() => {
    if (!selectedAssessmentId && completedActiveAssessmentOptions.length > 0) {
      setSelectedAssessmentId(completedActiveAssessmentOptions[0].value);
    }
  }, [selectedAssessmentId, completedActiveAssessmentOptions]);

  useEffect(() => {
    const token = sessionStorage.getItem("bearerToken");
    if (!token || !selectedAssessmentId) {
      setAssessmentDetail(null);
      setCompleteReportRiskAnalysis([]);
      setDbTop5Risks([]);
      setDbMitigationsByRiskId({});
      return;
    }
    const currentAssessmentId = selectedAssessmentId;
    const controller = new AbortController();
    fetch(`${BASE_URL}/buyerCotsAssessment/${encodeURIComponent(currentAssessmentId)}/vendor-risk-report`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (controller.signal.aborted) return;
        if (data?.success && data?.report && typeof data.report === "object") {
          const d = data.report as Record<string, unknown>;
          const reportRiskAnalysis = Array.isArray(d.riskAnalysis)
            ? (d.riskAnalysis as CompleteReportRiskDomain[]).filter((r) => {
                const s = String(r.riskScope ?? "").toLowerCase();
                return s !== "vendor";
              })
            : [];
          setCompleteReportRiskAnalysis(reportRiskAnalysis);
          setAssessmentDetail({
            assessmentId: currentAssessmentId,
            assessmentLabel: completedActiveAssessmentOptions.find((o) => o.value === currentAssessmentId)?.label,
            vendorName: (data.vendorName as string | undefined) ?? "",
            productName: (data.productName as string | undefined) ?? "",
            identifiedRisks: d.riskAnalysis,
            riskMitigation: d.recommendations,
            riskDomainScores: d.riskAnalysis,
            updatedAt: (d.generatedAt as string | undefined) ?? undefined,
          });
        } else {
          setAssessmentDetail(null);
          setCompleteReportRiskAnalysis([]);
        }
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setAssessmentDetail(null);
        setCompleteReportRiskAnalysis([]);
      });
    return () => controller.abort();
  }, [selectedAssessmentId, completedActiveAssessmentOptions]);

  useEffect(() => {
    const token = sessionStorage.getItem("bearerToken");
    if (!token || !selectedAssessmentId) {
      setDbTop5Risks([]);
      setDbMitigationsByRiskId({});
      return;
    }
    const currentAssessmentId = selectedAssessmentId;
    const controller = new AbortController();
    fetch(`${BASE_URL}/buyerCotsAssessment/${encodeURIComponent(currentAssessmentId)}/risk-mappings`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (controller.signal.aborted) return;
        if (data?.success && data?.data) {
          const top5 = Array.isArray(data.data.top5Risks) ? (data.data.top5Risks as DbMatchedRisk[]) : [];
          const mitigations =
            data.data.mitigationsByRiskId && typeof data.data.mitigationsByRiskId === "object"
              ? (data.data.mitigationsByRiskId as Record<string, DbMitigation[]>)
              : {};
          setDbTop5Risks(top5);
          setDbMitigationsByRiskId(mitigations);
        } else {
          setDbTop5Risks([]);
          setDbMitigationsByRiskId({});
        }
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setDbTop5Risks([]);
        setDbMitigationsByRiskId({});
      });
    return () => controller.abort();
  }, [selectedAssessmentId]);

  const riskItems = useMemo(
    () => buildRiskItems(assessmentDetail, completeReportRiskAnalysis, dbTop5Risks, dbMitigationsByRiskId),
    [assessmentDetail, completeReportRiskAnalysis, dbTop5Risks, dbMitigationsByRiskId],
  );
  const riskStats = useMemo(() => {
    const total = riskItems.length;
    const criticalHigh = riskItems.filter((r) => r.severity === "critical/high").length;
    const mitigated = riskItems.filter((r) => r.status === "mitigated").length;
    const open = riskItems.filter((r) => r.status === "open").length;
    return { total, criticalHigh, mitigated, open };
  }, [riskItems]);

  return (
    <>
      <HeaderEachPage icon=<ShieldAlert/> main_text="Risk & Controls" sub_text="Risk register, framework mappings, and gap analysis per assessment"/>
      <div className="sec_user_page org_settings_page" style={{ paddingTop: 0 }}>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <div style={{ minWidth: 320 }}>
            <Select
              id="risk_mapping_assessment"
              name="risk_mapping_assessment"
              labelName="Assessment"
              value={selectedAssessmentId}
              default_option="Select completed active assessment"
              options={completedActiveAssessmentOptions}
              onChange={(e) => setSelectedAssessmentId(e.target.value)}
            />
          </div>
        </div>
        <div
          role="tablist"
          aria-label="Risk mapping views"
          style={{
            marginTop: "1rem",
            display: "flex",
            gap: "0.5rem",
            borderBottom: "1px solid #e5e7eb",
            paddingBottom: "0.5rem",
          }}
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "risk_register"}
            onClick={() => setActiveTab("risk_register")}
            style={{
              border: "1px solid #d1d5db",
              borderRadius: "8px",
              padding: "0.5rem 0.8rem",
              background: activeTab === "risk_register" ? "#eff6ff" : "#ffffff",
              color: activeTab === "risk_register" ? "#1d4ed8" : "#374151",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Risk Register
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "framework_mappings"}
            onClick={() => setActiveTab("framework_mappings")}
            style={{
              border: "1px solid #d1d5db",
              borderRadius: "8px",
              padding: "0.5rem 0.8rem",
              background: activeTab === "framework_mappings" ? "#eff6ff" : "#ffffff",
              color: activeTab === "framework_mappings" ? "#1d4ed8" : "#374151",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Framework Mappings
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "gap_analysis"}
            onClick={() => setActiveTab("gap_analysis")}
            style={{
              border: "1px solid #d1d5db",
              borderRadius: "8px",
              padding: "0.5rem 0.8rem",
              background: activeTab === "gap_analysis" ? "#eff6ff" : "#ffffff",
              color: activeTab === "gap_analysis" ? "#1d4ed8" : "#374151",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Gap Analysis
          </button>
        </div>
        {activeTab === "risk_register" ? (
          <>
            <section
              style={{
                marginTop: "1rem",
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(180px, 1fr))",
                gap: "0.75rem",
              }}
            >
              <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "0.9rem" }}>
                <p style={{ margin: 0, fontSize: 13, color: "#4b5563", fontWeight: 600 }}>Total Risks</p>
                <p style={{ margin: "0.35rem 0 0", fontSize: 32, fontWeight: 700, color: "#111827", lineHeight: 1.1 }}>{riskStats.total}</p>
              </div>
              <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "0.9rem" }}>
                <p style={{ margin: 0, fontSize: 13, color: "#b91c1c", fontWeight: 600 }}>Critical/High</p>
                <p style={{ margin: "0.35rem 0 0", fontSize: 32, fontWeight: 700, color: "#b91c1c", lineHeight: 1.1 }}>{riskStats.criticalHigh}</p>
              </div>
              <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "0.9rem" }}>
                <p style={{ margin: 0, fontSize: 13, color: "#059669", fontWeight: 600 }}>Mitigated</p>
                <p style={{ margin: "0.35rem 0 0", fontSize: 32, fontWeight: 700, color: "#059669", lineHeight: 1.1 }}>{riskStats.mitigated}</p>
              </div>
              <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "0.9rem" }}>
                <p style={{ margin: 0, fontSize: 13, color: "#111827", fontWeight: 600 }}>Open</p>
                <p style={{ margin: "0.35rem 0 0", fontSize: 32, fontWeight: 700, color: "#d97706", lineHeight: 1.1 }}>{riskStats.open}</p>
              </div>
            </section>
            <section
              style={{
                marginTop: "0.8rem",
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: "12px",
                padding: "1rem",
              }}
            >
              <h3 style={{ margin: 0, fontSize: 20, color: "#111827" }}>
                Risk Register - {assessmentDetail?.assessmentLabel ?? "Selected Assessment"}
              </h3>
              <p style={{ margin: "0.35rem 0 1rem", color: "#6b7280" }}>
                Identified risks, owners, and mitigation status.
              </p>
              {riskItems.length === 0 ? (
                <p style={{ margin: 0, color: "#6b7280" }}>No identified risks were found for this assessment.</p>
              ) : (
                <div style={{ display: "grid", gap: "0.7rem" }}>
                  {riskItems.map((risk) => (
                    <div
                      key={risk.id}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: "10px",
                        padding: "0.85rem",
                        background: "#fafafa",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                          <span style={{ fontSize: 12, fontWeight: 700, background: "#f3f4f6", borderRadius: 6, padding: "2px 6px" }}>{risk.id}</span>
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              color: risk.severity === "critical/high" ? "#1d4ed8" : risk.severity === "medium" ? "#92400e" : "#475569",
                              background: risk.severity === "critical/high" ? "#dbeafe" : risk.severity === "medium" ? "#fef3c7" : "#e2e8f0",
                              borderRadius: 6,
                              padding: "2px 6px",
                              textTransform: "lowercase",
                            }}
                          >
                            {risk.severity}
                          </span>
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              color: risk.status === "open" ? "#be123c" : "#047857",
                              background: risk.status === "open" ? "#ffe4e6" : "#d1fae5",
                              borderRadius: 6,
                              padding: "2px 6px",
                              textTransform: "lowercase",
                            }}
                          >
                            {risk.status}
                          </span>
                        </div>
                        <span style={{ fontSize: 12, color: "#6b7280" }}>{risk.date}</span>
                      </div>
                      <h4 style={{ margin: "0.45rem 0 0.2rem", fontSize: 20, fontWeight: 600, color: "#111827" }}>{risk.title}</h4>
                      <p style={{ margin: 0, color: "#6b7280" }}>{risk.description}</p>
                      <div style={{ marginTop: "0.55rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.6rem" }}>
                        <span style={{ color: "#6b7280", fontSize: 13 }}>{risk.owner}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 120 }}>
                          <div style={{ height: 6, flex: 1, borderRadius: 999, background: "#dbeafe" }}>
                            <div style={{ width: `${risk.progressPercent}%`, height: "100%", borderRadius: 999, background: "#2563eb" }} />
                          </div>
                          <span style={{ color: "#6b7280", fontSize: 12 }}>{risk.progressPercent}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        ) : activeTab === "framework_mappings" ? (
          <section
            style={{
              marginTop: "1rem",
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: "12px",
              padding: "1rem",
            }}
          >
            <p style={{ margin: 0, color: "#4b5563" }}>
              Framework Mappings view for the selected assessment.
            </p>
          </section>
        ) : (
          <section
            style={{
              marginTop: "1rem",
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: "12px",
              padding: "1rem",
            }}
          >
            <p style={{ margin: 0, color: "#4b5563" }}>
              Gap Analysis view for the selected assessment.
            </p>
          </section>
        )}
      </div>
    </>
  );
};

export default MyVendors;
