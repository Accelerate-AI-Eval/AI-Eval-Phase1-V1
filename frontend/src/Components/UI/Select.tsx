import React from "react";

type Option = {
  label: string;
  value: string;
};

type SelectProps = {
  labelName ?: string | React.ReactNode;
  id?: string;
  icon?: React.ReactNode;
  name: string;
  value: string;
  default_option?: string;
  options : Option[];
  required?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
};



const Select = ({
  labelName,
  id,
  icon,
  name,
  value,
  default_option,
  options,
  required,
  onChange,
}: SelectProps) => {
  // console.log(options);
  return (
    <>
      <label htmlFor={id || name} className="select_label">
        {icon && <span className="icon">{icon}</span>}
        {labelName}
      </label>

      <select
        id={id || name}
        name={name}
        value={value}
        onChange={onChange}
        className={`select_input ${!value ? "select_input--placeholder" : ""}`}
        required={required}
      >
        <option value="" disabled>
          {default_option}
        </option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </>
  );
};

export default Select;
