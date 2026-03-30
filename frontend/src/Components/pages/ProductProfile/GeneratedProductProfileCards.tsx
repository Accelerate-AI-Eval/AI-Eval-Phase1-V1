/**
 * Renders generated product profile report: Trust Score cards on top, then section cards.
 * Data comes from POST /vendorSelfAttestation/generate-profile (no file).
 */
import {
  Package,
  Building2,
  Cpu,
  Brain,
  Lock,
  Database,
  Phone,
  Award,
  Users,
} from "lucide-react";
import type { GeneratedProductProfileReport } from "../../../types/generatedProductProfile";
import "./GeneratedProductProfileCards.css";

const SECTION_ICONS: Record<number, React.ReactNode> = {
  1: <Package size={24} aria-hidden />,
  2: <Building2 size={24} aria-hidden />,
  3: <Cpu size={24} aria-hidden />,
  4: <Brain size={24} aria-hidden />,
  5: <Lock size={24} aria-hidden />,
  6: <Database size={24} aria-hidden />,
  7: <Award size={24} aria-hidden />,
  8: <Phone size={24} aria-hidden />,
  9: <Users size={24} aria-hidden />,
};

const SECTION_ICON_CLASS: Record<number, string> = {
  1: "generated_profile_icon_blue",
  2: "generated_profile_icon_blue",
  3: "generated_profile_icon_purple",
  4: "generated_profile_icon_purple",
  5: "generated_profile_icon_blue",
  6: "generated_profile_icon_orange",
  7: "generated_profile_icon_green",
  8: "generated_profile_icon_teal",
  9: "generated_profile_icon_red",
};

/** Default subtitles per section to match reference UI when report omits subtitle */
const SECTION_SUBTITLES: Record<number, string> = {
  1: "Product details, deployment, and market positioning.",
  2: "Corporate structure and financial profile.",
  3: "Model architecture, training, and oversight.",
  4: "Ethics, oversight, and governance practices.",
  5: "Security controls and infrastructure.",
  6: "Data handling, privacy, and retention.",
  7: "Regulatory frameworks and audit status.",
  8: "SLAs, support coverage, and change management.",
  9: "Critical vendors and supply chain.",
};

export interface SectionVisibilityControl {
  visible: boolean;
  onToggle: (value: boolean) => void;
}

/** Remove trailing "---", "--", or " -" from summary text for display. */
function summaryForDisplay(summary: string | null | undefined): string {
  if (!summary || typeof summary !== "string") return "";
  return summary.replace(/\s*-+\s*$/, "").trim();
}

export interface GeneratedProductProfileCardsProps {
  report: GeneratedProductProfileReport;
  /** When set, each section card (not Trust Score) can show a "Visible to buyers" toggle. */
  sectionVisibility?: (sectionId: number) => SectionVisibilityControl | null;
}

function GeneratedProductProfileCards({ report, sectionVisibility }: GeneratedProductProfileCardsProps) {
  const { trustScore, sections } = report;
  const scoreNumber = trustScore.overallScore != null ? `${trustScore.overallScore}%` : "—";

  return (
    <div className="generated_profile_wrap">
      {/* Trust Score on top – number then label (match reference: large green number, "Trust Score" below) */}
      <section className="generated_profile_trust_section" aria-label="Trust Score">
        <div className="generated_profile_trust_cards">
          <div className="generated_profile_trust_card generated_profile_trust_main">
            <div className="generated_profile_trust_score_block">
              <span className="generated_profile_trust_score_value" aria-hidden="true">{scoreNumber}</span>
              <span className="generated_profile_trust_score_label">Trust Score</span>
            </div>
            <div className="generated_profile_trust_summary_block">
              <p className="generated_profile_trust_cat_title">Summary:</p>
              <p className="generated_profile_trust_summary">
                {trustScore.summary && trustScore.summary.trim() ? summaryForDisplay(trustScore.summary) : "—"}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section cards – each can have a "Visible to buyers" toggle when sectionVisibility is provided */}
      <section className="generated_profile_sections" aria-label="Product profile details">
        <div className="generated_profile_sections_grid">
          {sections.map((sec) => {
            const icon = SECTION_ICONS[sec.id];
            const iconClass = SECTION_ICON_CLASS[sec.id] ?? "generated_profile_icon_default";
            const subtitle = sec.subtitle ?? SECTION_SUBTITLES[sec.id];
            const visibility = sectionVisibility?.(sec.id);
            return (
              <div
                key={sec.id}
                className={`generated_profile_section_card${sec.id === 1 ? " generated_profile_section_card_full_row" : ""}`}
                data-section-id={sec.id}
              >
                <div className="generated_profile_section_header">
                  <div className="icon_header_product_data">
<span className={`generated_profile_section_icon ${iconClass}`} aria-hidden>
                    {icon ?? <Package size={24} aria-hidden />}
                  </span>
                  <div className="generated_profile_section_header_text">
                    <h3 className="generated_profile_section_title">{sec.title}</h3>
                    {subtitle && (
                      <p className="generated_profile_section_subtitle">{subtitle}</p>
                    )}
                  </div>
                  </div>
                  
                  {visibility && (
                    <div className="generated_profile_section_toggle">
                      <button
                        type="button"
                        className="product_profile_toggle product_profile_product_toggle"
                        aria-pressed={visibility.visible}
                        onClick={() => visibility.onToggle(!visibility.visible)}
                        aria-label={`Toggle ${sec.title} visible to buyers`}
                      />
                      <span className="generated_profile_section_toggle_label">Visible to buyers</span>
                    </div>
                  )}
                </div>
                <ul className="generated_profile_section_list">
                  {Object.entries(sec.items).map(([label, value]) => (
                    <li key={label} className="generated_profile_section_item">
                      <span className="generated_profile_section_item_label">{label}:</span>{" "}
                      <span className="generated_profile_section_item_value">{value}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export default GeneratedProductProfileCards;
