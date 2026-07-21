import { useEffect, useId } from "react";
import { Cpu, SlidersHorizontal } from "lucide-react";
import "../UserManagement/user_management.css";
import "./controls.css";
import { AiRiskApiKeyCard } from "./AiRiskApiKeyCard";
import { ModelCompatibilityChecker } from "./ModelCompatibilityChecker";

function Controls() {
  const baseId = useId();

  useEffect(() => {
    document.title = "AI-Q | Controls";
  }, []);

  return (
    <div className="controlsPage sec_user_page org_settings_page">
      <div className="org_settings_header page_header_align">
        <div className="org_settings_headers page_header_row">
          <span className="icon_size_header" aria-hidden>
            <SlidersHorizontal size={24} className="header_icon_svg" />
          </span>
          <div className="page_header_title_block">
            <h1 className="org_settings_title page_header_title">Controls</h1>
            <p className="org_settings_subtitle page_header_subtitle">
              Manage platform controls and configuration.
            </p>
          </div>
        </div>
      </div>

      <div className="controlsPage__cards">
        <section
          className="org_settings_card controlsPage__card"
          aria-labelledby={`${baseId}-llm-title`}
        >
          <div className="controlsPage__cardHead">
            <span className="controlsPage__cardIconWrap" aria-hidden>
              <Cpu size={20} strokeWidth={2} />
            </span>
            <div>
              <h2 id={`${baseId}-llm-title`} className="controlsPage__cardTitle">
                LLM Model Configuration
              </h2>
              <p className="controlsPage__cardHint">
                Choose and validate the Bedrock model used for AI assessments.
              </p>
            </div>
          </div>

          <ModelCompatibilityChecker idPrefix={`${baseId}-llm-model`} />
        </section>

        <AiRiskApiKeyCard idPrefix={`${baseId}-api-key`} />
      </div>
    </div>
  );
}

export default Controls;
