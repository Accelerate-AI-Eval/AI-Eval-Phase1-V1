import { useId, useState } from "react";
import { Copy, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";

type AiRiskApiKeyCardProps = {
  idPrefix?: string;
};

export function AiRiskApiKeyCard({ idPrefix }: AiRiskApiKeyCardProps) {
  const generatedId = useId();
  const baseId = idPrefix ?? generatedId;
  const inputId = `${baseId}-input`;

  const [apiKey, setApiKey] = useState("");
  const [appliedKey, setAppliedKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">(
    "idle",
  );
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">(
    "idle",
  );
  const [statusMessage, setStatusMessage] = useState("");

  const hasAppliedKey = Boolean(appliedKey.trim());
  const canSave = Boolean(apiKey.trim()) && apiKey.trim() !== appliedKey;
  const canCopy = Boolean((apiKey || appliedKey).trim());

  const handleCopy = async () => {
    const value = (apiKey || appliedKey).trim();
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      setCopyStatus("copied");
      setStatusMessage("API key copied to clipboard.");
      window.setTimeout(() => {
        setCopyStatus("idle");
        setStatusMessage((msg) =>
          msg === "API key copied to clipboard." ? "" : msg,
        );
      }, 2000);
    } catch {
      setCopyStatus("error");
      setStatusMessage("Unable to copy API key.");
    }
  };

  const handleSave = () => {
    const value = apiKey.trim();
    if (!value) {
      setSaveStatus("error");
      setStatusMessage("Enter an API key before saving.");
      return;
    }

    setIsSaving(true);
    setSaveStatus("idle");
    setStatusMessage("");

    window.setTimeout(() => {
      setAppliedKey(value);
      setApiKey(value);
      setIsSaving(false);
      setSaveStatus("success");
      setStatusMessage("AI Risk API key saved.");
    }, 250);
  };

  const statusClassName =
    saveStatus === "error" || copyStatus === "error"
      ? "adminPage__modelStatus adminPage__modelStatus--error"
      : saveStatus === "success" || copyStatus === "copied"
        ? "adminPage__modelStatus adminPage__modelStatus--success"
        : "adminPage__modelStatus";

  return (
    <section
      className="org_settings_card controlsPage__card"
      aria-labelledby={`${baseId}-title`}
    >
      <div className="controlsPage__cardHead">
        <span className="controlsPage__cardIconWrap" aria-hidden>
          <KeyRound size={20} strokeWidth={2} />
        </span>
        <div>
          <h2 id={`${baseId}-title`} className="controlsPage__cardTitle">
            AI Risk API Key
          </h2>
          <p className="controlsPage__cardHint">
            Configure the API key used for AI Risk integrations.
          </p>
        </div>
      </div>

      <div className="adminPage__modelField">
        <div className="adminPage__modelLabelRow">
          <label className="adminPage__modelLabel" htmlFor={inputId}>
            API key
          </label>
          <span
            className="adminPage__modelCurrent"
            role="status"
            aria-live="polite"
          >
            {hasAppliedKey ? "Configured" : "Not set"}
          </span>
        </div>

        <div className="adminPage__modelControls">
          <div className="controlsPage__apiKeyInputWrap">
            <input
              id={inputId}
              className="controlsPage__apiKeyInput"
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(event) => {
                setApiKey(event.target.value);
                setSaveStatus("idle");
                if (copyStatus !== "idle") setCopyStatus("idle");
                setStatusMessage("");
              }}
              placeholder="Enter AI Risk API key"
              autoComplete="off"
              spellCheck={false}
              disabled={isSaving}
            />
            <button
              type="button"
              className="controlsPage__apiKeyToggle"
              onClick={() => setShowKey((value) => !value)}
              aria-label={showKey ? "Hide API key" : "Show API key"}
              disabled={isSaving}
            >
              {showKey ? (
                <EyeOff size={18} strokeWidth={1.75} aria-hidden />
              ) : (
                <Eye size={18} strokeWidth={1.75} aria-hidden />
              )}
            </button>
          </div>

          <div className="adminPage__modelActions">
            <button
              type="button"
              className="adminPage__ghostBtn adminPage__modelTestBtn"
              onClick={() => void handleCopy()}
              disabled={!canCopy || isSaving}
            >
              <Copy size={16} aria-hidden />
              {copyStatus === "copied" ? "Copied" : "Copy"}
            </button>
            <button
              type="button"
              className="usersPage__btn usersPage__btn--primary adminPage__modelApplyBtn"
              onClick={handleSave}
              disabled={!canSave || isSaving}
              aria-busy={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2
                    className="usersPage__spinner"
                    size={16}
                    aria-hidden
                  />
                  Saving…
                </>
              ) : (
                "Save"
              )}
            </button>
          </div>
        </div>

        {statusMessage ? (
          <p className={statusClassName} role="status" aria-live="polite">
            {statusMessage}
          </p>
        ) : null}
      </div>
    </section>
  );
}
