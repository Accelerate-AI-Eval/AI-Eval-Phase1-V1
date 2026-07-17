import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  applyLlmModel,
  fetchLlmModelConfig,
  testLlmModel,
  type LlmModelOption,
} from "../../../utils/llmModelApi";
import { LlmModelPicker } from "./LlmModelPicker";
import {
  ModelTestResultDialog,
  type ModelTestDialogState,
} from "./ModelTestResultDialog";

type TestResult = "success" | "failure" | null;
type ApplyResult = "success" | "failure" | null;

type ModelCompatibilityCheckerProps = {
  idPrefix: string;
};

function modelLabelFor(options: LlmModelOption[], modelId: string): string {
  if (!modelId) return "";
  const exact = options.find((option) => option.id === modelId);
  if (exact) return exact.label;
  const lower = modelId.toLowerCase();
  const match = options.find(
    (option) =>
      option.id.toLowerCase() === lower ||
      option.label.toLowerCase() === lower,
  );
  return match?.label ?? modelId;
}

export function ModelCompatibilityChecker({
  idPrefix,
}: ModelCompatibilityCheckerProps) {
  const [options, setOptions] = useState<LlmModelOption[]>([]);
  const [inferenceProfiles, setInferenceProfiles] = useState(false);
  const [selectedModel, setSelectedModel] = useState("");
  const [selectedModelLabel, setSelectedModelLabel] = useState("");
  const [appliedModel, setAppliedModel] = useState("");
  const [appliedModelLabel, setAppliedModelLabel] = useState("");
  const [validatedModel, setValidatedModel] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [testResult, setTestResult] = useState<TestResult>(null);
  const [testStatusMessage, setTestStatusMessage] = useState("");
  const [applyResult, setApplyResult] = useState<ApplyResult>(null);
  const [applyStatusMessage, setApplyStatusMessage] = useState("");
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testDialogResult, setTestDialogResult] =
    useState<ModelTestDialogState | null>(null);

  const loadConfig = useCallback(async () => {
    const token = sessionStorage.getItem("bearerToken");
    if (!token) {
      setOptionsLoading(false);
      setApplyStatusMessage("Sign in to manage LLM models.");
      return;
    }

    setOptionsLoading(true);
    try {
      const result = await fetchLlmModelConfig();
      if (!result.ok) {
        setApplyStatusMessage(result.message);
        setApplyResult("failure");
        return;
      }

      setOptions(result.config.options);
      setInferenceProfiles(Boolean(result.config.inferenceProfiles));
      setSelectedModel(result.config.modelId);
      setSelectedModelLabel(result.config.modelLabel);
      setAppliedModel(result.config.modelId);
      setAppliedModelLabel(result.config.modelLabel);
      setApplyResult(null);
      setApplyStatusMessage("");
    } finally {
      setOptionsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      await loadConfig();
      if (cancelled) return;
    })();

    return () => {
      cancelled = true;
    };
  }, [loadConfig]);

  const handleModelChange = (modelId: string) => {
    setSelectedModel(modelId);
    setSelectedModelLabel(modelLabelFor(options, modelId));
    setTestResult(null);
    setTestStatusMessage("");
    setApplyResult(null);
    setValidatedModel(null);
    setTestDialogOpen(false);
    setTestDialogResult(null);
  };

  const openTestDialog = (result: ModelTestDialogState) => {
    setTestDialogResult(result);
    setTestDialogOpen(true);
  };

  const handleTest = async () => {
    if (!selectedModel || isTesting || isApplying) return;

    setIsTesting(true);
    setTestResult(null);
    setTestStatusMessage("");
    setValidatedModel(null);
    setTestDialogOpen(false);
    setTestDialogResult(null);

    const modelLabel = modelLabelFor(options, selectedModel);

    try {
      const result = await testLlmModel(selectedModel);

      if (!result.ok) {
        setTestResult("failure");
        setTestStatusMessage(
          "Test failed — Apply is disabled until the test passes.",
        );
        openTestDialog({
          success: false,
          message: result.message,
          modelId: selectedModel,
          modelLabel,
        });
        return;
      }

      if (result.result.success) {
        setTestResult("success");
        setValidatedModel(selectedModel);
        setTestStatusMessage(
          "Test passed — you can click Apply to set this as the active model.",
        );
        openTestDialog({
          success: true,
          message: result.result.message,
          modelId: selectedModel,
          modelLabel,
          invokeModelId: result.result.invokeModelId,
          workingVia: result.result.workingVia,
          response: result.result.response,
          fulfillmentResponse: result.result.fulfillmentResponse,
        });
        return;
      }

      setTestResult("failure");
      setTestStatusMessage(
        "Test failed — Apply is disabled until the test passes.",
      );
      openTestDialog({
        success: false,
        message: result.result.message,
        modelId: selectedModel,
        modelLabel,
        invokeModelId: result.result.invokeModelId,
        workingVia: result.result.workingVia,
        response: result.result.response,
        fulfillmentResponse: result.result.fulfillmentResponse,
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleApply = async () => {
    if (!selectedModel || isApplying || isTesting || optionsLoading) {
      return;
    }

    setIsApplying(true);
    setApplyResult(null);
    setApplyStatusMessage("");

    try {
      const result = await applyLlmModel(selectedModel);
      if (!result.ok) {
        setApplyResult("failure");
        setApplyStatusMessage(result.message);
        return;
      }

      setAppliedModel(result.config.modelId);
      setAppliedModelLabel(result.config.modelLabel);
      setSelectedModel(result.config.modelId);
      setSelectedModelLabel(result.config.modelLabel);
      setApplyResult("success");
      setTestStatusMessage("");
      setApplyStatusMessage(`Active model set to ${result.config.modelLabel}.`);

      if (result.config.pythonSynced === false) {
        setApplyStatusMessage("Warning: Python service sync failed.");
        setApplyResult("failure");
      } else if (result.config.requiresPythonRestart) {
        setApplyStatusMessage("Restart the Python service to apply the change.");
      }
    } finally {
      setIsApplying(false);
    }
  };

  const canTest =
    Boolean(selectedModel) &&
    !isTesting &&
    !isApplying &&
    !optionsLoading &&
    options.length > 0;

  const canApply =
    Boolean(selectedModel) &&
    validatedModel === selectedModel &&
    !isTesting &&
    !isApplying &&
    !optionsLoading &&
    options.length > 0;

  const testStatusClassName =
    testResult === "failure"
      ? "adminPage__modelStatus adminPage__modelStatus--error"
      : testResult === "success"
        ? "adminPage__modelStatus adminPage__modelStatus--success"
        : "adminPage__modelStatus";

  const applyStatusClassName =
    applyResult === "failure"
      ? "adminPage__modelStatus adminPage__modelStatus--error"
      : applyResult === "success"
        ? "adminPage__modelStatus adminPage__modelStatus--success"
        : "adminPage__modelStatus";

  return (
    <>
      <div className="adminPage__modelField">
        <div className="adminPage__modelLabelRow">
          <label
            className="adminPage__modelLabel"
            htmlFor={`${idPrefix}-trigger`}
          >
            LLM model
          </label>
          <span
            className="adminPage__modelCurrent"
            role="status"
            aria-live="polite"
            title={appliedModel || undefined}
          >
            {optionsLoading
              ? "Loading…"
              : appliedModelLabel || appliedModel || "—"}
          </span>
        </div>

        <div className="adminPage__modelControls">
          <div className="adminPage__modelPickerRow">
            <LlmModelPicker
              idPrefix={idPrefix}
              options={options}
              value={selectedModel}
              selectedLabel={selectedModelLabel}
              inferenceProfiles={inferenceProfiles}
              onChange={handleModelChange}
              disabled={isApplying || isTesting || !options.length}
              loading={optionsLoading}
            />
          </div>

          <div className="adminPage__modelActions">
            <button
              type="button"
              className="adminPage__ghostBtn adminPage__modelTestBtn"
              onClick={() => void handleTest()}
              disabled={!canTest}
              aria-busy={isTesting}
            >
              {isTesting ? (
                <>
                  <Loader2
                    className="usersPage__spinner"
                    size={16}
                    aria-hidden
                  />
                  Testing…
                </>
              ) : (
                "Test"
              )}
            </button>
            <button
              type="button"
              className="usersPage__btn usersPage__btn--primary adminPage__modelApplyBtn"
              onClick={() => void handleApply()}
              disabled={!canApply}
              aria-busy={isApplying}
              title={
                canApply
                  ? undefined
                  : "Run Test successfully before applying this model"
              }
            >
              {isApplying ? (
                <>
                  <Loader2
                    className="usersPage__spinner"
                    size={16}
                    aria-hidden
                  />
                  Applying…
                </>
              ) : (
                "Apply"
              )}
            </button>
          </div>
        </div>

        {testStatusMessage ? (
          <p className={testStatusClassName} role="status" aria-live="polite">
            {testStatusMessage}
          </p>
        ) : null}

        {applyStatusMessage ? (
          <p className={applyStatusClassName} role="status" aria-live="polite">
            {applyStatusMessage}
          </p>
        ) : null}
      </div>

      <ModelTestResultDialog
        open={testDialogOpen}
        result={testDialogResult}
        onClose={() => {
          setTestDialogOpen(false);
          setTestDialogResult(null);
        }}
      />
    </>
  );
}
