import "../../styles/chip_multi_select.css";

export interface ChipOption {
  label: string;
  value: string;
}

interface ChipMultiSelectProps {
  id?: string;
  labelName?: React.ReactNode;
  description?: string;
  options: ChipOption[];
  value: string[];
  onChange: (selected: string[]) => void;
}

function ChipMultiSelect({
  id,
  labelName,
  description,
  options,
  value,
  onChange,
}: ChipMultiSelectProps) {
  function toggle(optionValue: string) {
    const next = value.includes(optionValue)
      ? value.filter((v) => v !== optionValue)
      : [...value, optionValue];
    onChange(next);
  }

  return (
    <div className="chip-multi-select" id={id}>
      {labelName != null && <label>{labelName}</label>}
      <div className="chip-multi-select-grid" role="group">
        {options.map((opt) => {
          const selected = value.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              className={`chip-multi-select-chip ${selected ? "chip-multi-select-chip--selected" : ""}`}
              onClick={() => toggle(opt.value)}
              aria-pressed={selected}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default ChipMultiSelect;
