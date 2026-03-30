import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FileText,
  LayoutDashboard,
  Activity,
  Shield,
  AlertTriangle,
  Target,
  ExternalLink,
  ChevronDown,
  BarChart3,
  SquarePen,
  Plus,
  Sparkles,
  Send,
} from "lucide-react";
import { Chart } from "react-google-charts";
import { MetricCard, KPICard, RiskCard } from "../../UI/Card";
import Button from "../../UI/Button";
import LoadingMessage from "../../UI/LoadingMessage";
import type { AssessmentRow } from "./types";
import { BASE_URL, formatGovDate, getAssessmentLabel } from "./utils";
import "./dashboard.css";

const RISK_BREAKDOWN = [
  { category: "Security", level: "Low", variant: "low" as const },
  { category: "Privacy", level: "Medium", variant: "medium" as const },
  { category: "Operational", level: "Low", variant: "low" as const },
  { category: "Technical", level: "Medium", variant: "medium" as const },
  { category: "Compliance", level: "Low", variant: "low" as const },
];

const LOADER_MIN_MS = 2000;

const BuyerOverview = () => {
  const navigate = useNavigate();
  const [assessmentsList, setAssessmentsList] = useState<AssessmentRow[]>([]);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [aiSearchQuery, setAiSearchQuery] = useState("");

  const fetchAssessments = useCallback(() => {
    const token = sessionStorage.getItem("bearerToken");
    if (!token) {
      setLoading(false);
      return;
    }
    setFetchError(null);
    setLoading(true);
    const loadStart = Date.now();
    const finishLoading = () => {
      const remaining = Math.max(0, LOADER_MIN_MS - (Date.now() - loadStart));
      setTimeout(() => setLoading(false), remaining);
    };
    const organizationId = sessionStorage.getItem("organizationId");
    const query = organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : "";
    fetch(`${BASE_URL}/assessments${query}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then((result) => {
        if (result?.data?.assessments != null) {
          const list = result.data.assessments as AssessmentRow[];
          setAssessmentsList(list);
          const buyer = list.filter((a) => (a.type ?? "").toLowerCase() === "cots_buyer");
          const completed = buyer.filter((a) => (a.status ?? "").toLowerCase() !== "draft");
          setSelectedAssessmentId((prev) => {
            if (prev && completed.some((a) => String(a.assessmentId) === prev)) return prev;
            return completed.length > 0 ? String(completed[0].assessmentId) : "";
          });
        } else {
          setAssessmentsList([]);
          setSelectedAssessmentId("");
        }
      })
      .catch(() => {
        setFetchError("Failed to load assessments.");
        setAssessmentsList([]);
      })
      .finally(() => finishLoading());
  }, []);

  useEffect(() => {
    fetchAssessments();
  }, [fetchAssessments]);

  const systemRole = (sessionStorage.getItem("systemRole") ?? "").toLowerCase().trim().replace(/_/g, " ");
  const userRole = (sessionStorage.getItem("userRole") ?? "").toLowerCase().trim();
  const isViewOnlyRole =
    systemRole === "system viewer" || (systemRole === "buyer" && userRole === "viewer");

  const organizationId = sessionStorage.getItem("organizationId") ?? "";
  const orgScopedList = organizationId
    ? assessmentsList.filter((a) => String(a.organizationId ?? "") === String(organizationId))
    : assessmentsList;
  const buyerAssessments = orgScopedList.filter((a) => (a.type ?? "").toLowerCase() === "cots_buyer");
  const completedBuyerAssessments = buyerAssessments.filter((a) => (a.status ?? "").toLowerCase() !== "draft");
  const draftCount = buyerAssessments.filter((a) => (a.status ?? "").toLowerCase() === "draft").length;
  const completedCount = completedBuyerAssessments.length;
  const selectedAssessment = completedBuyerAssessments.find((a) => String(a.assessmentId) === selectedAssessmentId);

  const handleViewReport = (assessmentId: number) => {
    navigate("/reports", { state: { assessmentId } });
  };

  return (
    <div className="vendor_overview_page sec_user_page org_settings_page governance_overview">
      <div className="vendor_overview_heading page_header_align governance_overview_header">
        <div className="vendor_overview_headers page_header_row">
          <span className="icon_size_header" aria-hidden>
            <LayoutDashboard size={24} className="header_icon_svg" />
          </span>
          <div className="page_header_title_block">
            <h1 className="page_header_title">Organization Dashboard</h1>
            <p className="sub_title page_header_subtitle">
              Your AI risk posture and assessment pipeline.
            </p>
          </div>
        </div>
        <div className="vendor_overview_actions governance_overview_actions">
          <div className="governance_overview_select_wrap">
            <select
              className="governance_overview_select"
              value={selectedAssessmentId}
              onChange={(e) => setSelectedAssessmentId(e.target.value)}
              aria-label="Select assessment"
            >
              <option value="">Select an assessment</option>
              {completedBuyerAssessments.map((a) => (
                <option key={a.assessmentId} value={a.assessmentId}>
                  {getAssessmentLabel(a)}
                </option>
              ))}
            </select>
            <ChevronDown size={18} className="governance_overview_chevron governance_overview_chevron_select" aria-hidden />
          </div>
          {!isViewOnlyRole && (
            <div className="btn_user_page">
              <Button className="invite_user_btn" onClick={() => navigate("/buyerAssessment")}>
                <Plus size={24} />
                New Assessment
              </Button>
            </div>
          )}
        </div>
      </div>

      {loading && <LoadingMessage message="Loading assessments…" />}
      {fetchError && <div className="vendor_overview_error">{fetchError}</div>}

      {!loading && (
        <>
          <div className="vendor_overview_metrics vendor_overview_metrics_four governance_overview_metrics governance_overview_top_cards">
            <MetricCard
              icon={<Activity size={20} />}
              title="Risk Database"
              value="1,248"
              description="Catalogued risks"
            />
            <MetricCard
              icon={<Shield size={20} />}
              title="Mitigations"
              value="4,603"
              description="Mapped strategies"
            />
            <MetricCard
              icon={<FileText size={20} />}
              title="Assessments"
              value={buyerAssessments.length}
              description={`${completedCount} completed, ${draftCount} pending`}
            />
            <MetricCard
              icon={<AlertTriangle size={20} />}
              title="Risk Domains"
              value="6"
              description="Active categories"
            />
          </div>

          {selectedAssessment && (
            <div className="governance_evaluation_card governance_evaluation_card_highlight">
              <div className="governance_evaluation_header">
                <div className="governance_evaluation_title_meta">
                  <div className="governance_evaluation_title_block">
                    <Target size={20} className="governance_evaluation_target_icon" aria-hidden />
                    <h2 className="governance_evaluation_title">{getAssessmentLabel(selectedAssessment)}</h2>
                  </div>
                  <p className="governance_evaluation_meta">
                    cots_buyer • {(selectedAssessment.status ?? "").toLowerCase() === "draft"
                      ? `Draft ${formatGovDate(selectedAssessment.cotsUpdatedAt ?? selectedAssessment.updatedAt ?? selectedAssessment.createdAt)}`
                      : `Completed ${formatGovDate(selectedAssessment.cotsUpdatedAt ?? selectedAssessment.updatedAt ?? selectedAssessment.createdAt)}`}
                  </p>
                </div>
                {(selectedAssessment.status ?? "").toLowerCase() === "draft" ? (
                  <Link to={`/buyerAssessment/${selectedAssessment.assessmentId}`} className="governance_evaluation_view_report">
                    Edit assessment
                    <SquarePen size={16} />
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="governance_evaluation_view_report governance_evaluation_view_report_btn"
                    onClick={() => handleViewReport(selectedAssessment.assessmentId)}
                  >
                    View Report
                    <ExternalLink size={16} />
                  </button>
                )}
              </div>
              <div className="governance_evaluation_body">
                <div className="governance_kpis">
                  <KPICard value={84} label="Trust Score" variant="trust" />
                  <KPICard value={52} label="Inherent Risk" variant="inherent" />
                  <KPICard value="78%" label="Mitigation Effectiveness" variant="mitigation" />
                  <KPICard value="24.0" label="Residual Risk" variant="residual" />
                </div>
                <div className="governance_risk_breakdown">
                  <h3 className="governance_risk_breakdown_title">
                    <BarChart3 size={18} aria-hidden />
                    Risk Breakdown
                  </h3>
                  <ul className="governance_risk_list">
                    {RISK_BREAKDOWN.map(({ category, level, variant }) => (
                      <li key={category}>
                        <RiskCard category={category} level={level} variant={variant} />
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          <div className="governance_bottom_row">
            <div className="governance_bottom_card">
              <h3 className="governance_bottom_card_title">Risks by Intent</h3>
              <p className="governance_bottom_card_subtitle">Distribution of 1,248 risks by intent category.</p>
              <div className="governance_chart_wrapper governance_chart_bar">
                <Chart
                  chartType="BarChart"
                  width="100%"
                  height="220px"
                  data={[
                    ["Intent", "Risks"],
                    ["Buy", 420],
                    ["Build", 580],
                    ["Sell", 248],
                  ]}
                  options={{
                    chart: { title: "" },
                    bars: "horizontal",
                    legend: { position: "none" },
                    colors: ["#2563eb"],
                    bar: { groupWidth: "60%" },
                    hAxis: { minValue: 0, maxValue: 600 },
                    backgroundColor: "transparent",
                  }}
                />
              </div>
            </div>
            <div className="governance_bottom_card">
              <h3 className="governance_bottom_card_title">Risk Domains</h3>
              <p className="governance_bottom_card_subtitle">Top domains by risk count.</p>
              <div className="governance_chart_wrapper governance_chart_donut">
                <Chart
                  chartType="PieChart"
                  width="100%"
                  height="220px"
                  data={[
                    ["Domain", "Count"],
                    ["Security", 320],
                    ["Privacy", 280],
                    ["Operational", 248],
                    ["Technical", 220],
                    ["Compliance", 180],
                  ]}
                  options={{
                    pieHole: 0.6,
                    pieSliceText: "none",
                    legend: { position: "labeled" },
                    colors: ["#8b5cf6", "#f59e0b", "#22c55e", "#2563eb", "#ec4899"],
                    backgroundColor: "transparent",
                    chartArea: { width: "90%", height: "90%" },
                  }}
                />
              </div>
            </div>
            <div className="governance_bottom_card">
              <h3 className="governance_bottom_card_title">Recent Assessments</h3>
              <p className="governance_bottom_card_subtitle">Latest vendor and internal project reviews.</p>
              <ul className="governance_recent_list">
                {[...buyerAssessments]
                  .sort((a, b) => {
                    const da = new Date(a.updatedAt ?? a.createdAt ?? 0).getTime();
                    const db = new Date(b.updatedAt ?? b.createdAt ?? 0).getTime();
                    return db - da;
                  })
                  .slice(0, 5)
                  .map((a) => (
                    <li key={a.assessmentId} className="governance_recent_item">
                      <Activity size={18} className="governance_recent_icon" aria-hidden />
                      <div className="governance_recent_content">
                        <span className="governance_recent_title">{getAssessmentLabel(a)}</span>
                        <span className="governance_recent_date">{formatGovDate(a.cotsUpdatedAt ?? a.updatedAt ?? a.createdAt)}</span>
                      </div>
                      <span className={`governance_recent_status governance_recent_status_${(a.status ?? "").toLowerCase() === "draft" ? "draft" : "completed"}`}>
                        {(a.status ?? "").toLowerCase() === "draft" ? "Draft" : "Completed"}
                      </span>
                    </li>
                  ))}
                {buyerAssessments.length === 0 && (
                  <li className="governance_recent_empty">No assessments yet.</li>
                )}
              </ul>
            </div>
          </div>

          {!isViewOnlyRole && (
            <div className="governance_risk_search">
              <h3 className="governance_risk_search_title">
                <Sparkles size={20} aria-hidden />
                AI Risk Search
              </h3>
              <p className="governance_risk_search_subtitle">
                Searching risks for: {selectedAssessment ? getAssessmentLabel(selectedAssessment) : "Select an assessment"} …
              </p>
              <div className="governance_risk_search_suggestions">
                {[
                  "What are the privacy risks for AI chatbots?",
                  "Show me bias risks in hiring AI",
                  "What security vulnerabilities affect LLMs?",
                  "Risks of AI in healthcare decisions",
                  "Data leakage risks in generative AI",
                ].map((q) => (
                  <button key={q} type="button" className="governance_risk_search_pill" onClick={() => setAiSearchQuery(q)}>
                    {q}
                  </button>
                ))}
              </div>
              <div className="governance_risk_search_input_row">
                <input
                  type="text"
                  className="governance_risk_search_input"
                  placeholder="Ask about AI risks..."
                  value={aiSearchQuery}
                  onChange={(e) => setAiSearchQuery(e.target.value)}
                  aria-label="Ask about AI risks"
                />
                <button type="button" className="governance_risk_search_send" aria-label="Send">
                  <Send size={20} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default BuyerOverview;
