import React from "react";
import FormField from "../../../UI/FormField";
import ChipMultiSelect from "../../../UI/ChipMultiSelect";
import FieldError from "../../../UI/FieldError";

const defaultOption = "Select";

/** Parse multiselect form value: JSON array, plain array, or comma-separated string (draft DB format). */
function parseMultiselectValue(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.map((x) => String(x).trim()).filter(Boolean);
  }
  const s = String(raw).trim();
  if (!s) return [];
  try {
    const parsed = JSON.parse(s);
    if (Array.isArray(parsed)) {
      return parsed.map((x) => String(x).trim()).filter(Boolean);
    }
  } catch {
    /* comma-separated draft storage */
  }
  return s
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Renders input, single select, or multiselect based on field config. Multiselect values stored as JSON array string. */
const BuyerCotsField = ({
  fieldKey,
  label,
  placeholder,
  required,
  options,
  multiselect,
  value,
  onChange,
  readOnly,
  errorMessage,
}) => {
  const safeValue = value ?? "";

  // Read-only from onboarding: show value only (no dropdown) so geographic regions / tech stack display as plain text
  if (readOnly) {
    if (options && multiselect) {
      const displayText = parseMultiselectValue(safeValue).join(", ");
      return (
        <>
          <FormField label={label} mandatory={required} tooltipText={placeholder}>
            <input
              type="text"
              value={displayText}
              readOnly
              className="input_readonly"
              aria-label={label}
            />
          </FormField>
          {errorMessage && <FieldError message={errorMessage} />}
        </>
      );
    }
    if (options && !multiselect) {
      const strValue = typeof safeValue === "string" ? safeValue : String(safeValue);
      const valueInOptions = options.some((o) => o.value === strValue || o.label === strValue);
      return (
        <>
          <FormField label={label} mandatory={required} tooltipText={placeholder}>
            <select
              value={strValue || ""}
              disabled
              readOnly
              className="select_input input_readonly"
              aria-label={label}
            >
              <option value="">{placeholder || defaultOption}</option>
              {options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
              {!valueInOptions && strValue ? (
                <option value={strValue}>{strValue}</option>
              ) : null}
            </select>
          </FormField>
          {errorMessage && <FieldError message={errorMessage} />}
        </>
      );
    }
    return (
      <>
        <FormField label={label} mandatory={required} tooltipText={placeholder}>
          <input
            type="text"
            value={typeof safeValue === "string" ? safeValue : (Array.isArray(safeValue) ? safeValue.join(", ") : JSON.stringify(safeValue))}
            readOnly
            className="input_readonly"
            aria-label={label}
          />
        </FormField>
        {errorMessage && <FieldError message={errorMessage} />}
      </>
    );
  }

  if (options && multiselect) {
    const selected = parseMultiselectValue(safeValue);
    return (
      <>
        <FormField label={label} mandatory={required} tooltipText={placeholder}>
          <ChipMultiSelect
            id={fieldKey}
            labelName=""
            options={options}
            value={selected}
            onChange={(selectedValues) => onChange(JSON.stringify(selectedValues))}
          />
        </FormField>
        {errorMessage && <FieldError message={errorMessage} />}
      </>
    );
  }

  if (options && !multiselect) {
    return (
      <>
        <FormField label={label} mandatory={required} tooltipText={placeholder}>
          <select
            value={safeValue}
            onChange={(e) => onChange(e.target.value)}
            className={`select_input ${!safeValue ? "select_input--placeholder" : ""}`}
            aria-label={label}
          >
            <option value="">{placeholder || defaultOption}</option>
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </FormField>
        {errorMessage && <FieldError message={errorMessage} />}
      </>
    );
  }

  return (
    <>
      <FormField label={label} mandatory={required} tooltipText={placeholder}>
        <input
          type="text"
          value={safeValue}
          onChange={(e) => onChange(e.target.value)}
        />
      </FormField>
      {errorMessage && <FieldError message={errorMessage} />}
    </>
  );
};

export default BuyerCotsField;
