// SelectField.jsx — thay thế trực tiếp cho <select> gốc: cùng cách viết (value, onChange, <option>),
// nhưng hiển thị bằng RoundedSelect để danh sách thả xuống bo góc, đúng giao diện chung.
import { useState } from "react";
import RoundedSelect from "./F1/assessment/RoundedSelect";
import { parseSelectOptions } from "./selectOptions";

// Các lớp bố cục viết cho <select> cũ (flex-1, shrink-0, min-w-...) cần áp lên khung ngoài của ô chọn.
const WRAPPER_CLASS = /^(flex-\S*|shrink-0|grow|basis-\S+|min-w-\S+|max-w-\S+|self-\S+|col-span-\S+|order-\S+)$/;

const wrapperClassFor = (className) => {
  const tokens = String(className || "")
    .split(/\s+/)
    .filter((token) => WRAPPER_CLASS.test(token));
  return ["relative", ...tokens].join(" ");
};

const SelectField = ({
  value,
  defaultValue,
  onChange,
  children,
  className,
  disabled = false,
  required = false,
  id,
  name,
  tone = "light",
  placeholder,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
}) => {
  const [innerValue, setInnerValue] = useState(defaultValue ?? "");
  const controlled = value !== undefined;
  const current = String((controlled ? value : innerValue) ?? "");

  const handleChange = (next) => {
    if (!controlled) setInnerValue(next);
    const target = { value: next, name, id };
    onChange?.({ target, currentTarget: target });
  };

  return (
    <div className={wrapperClassFor(className)}>
      <RoundedSelect
        id={id}
        label={ariaLabel}
        value={current}
        options={parseSelectOptions(children)}
        onChange={handleChange}
        disabled={disabled}
        tone={tone}
        triggerClassName={className}
        placeholder={placeholder}
        buttonProps={{
          "aria-describedby": ariaDescribedBy,
          "aria-invalid": ariaInvalid,
        }}
      />
      {required && (
        <input
          tabIndex={-1}
          aria-hidden="true"
          required
          value={current}
          onChange={() => {}}
          className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
        />
      )}
    </div>
  );
};

export default SelectField;
