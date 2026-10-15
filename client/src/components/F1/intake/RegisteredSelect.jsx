import { useContext } from "react";
import { useWatch } from "react-hook-form";
import RoundedSelect from "../assessment/RoundedSelect";
import { SelectControlContext } from "./selectControlContext";

// Giữ nguyên `registration.onChange` của form (một số bước gắn thêm xử lý riêng khi đổi giá trị).
const ControlledSelect = ({ control, registration, onChange, label, options, placeholder }) => {
  const value = useWatch({ control, name: registration.name });
  return (
    <RoundedSelect
      label={label}
      value={value ?? ""}
      onChange={(next) => {
        const event = { target: { name: registration.name, value: next } };
        // Như `<select {...registration} {...props}>` trước đây: onChange riêng của bước thay cho của form.
        (onChange || registration.onChange)(event);
      }}
      options={options}
      placeholder={placeholder}
    />
  );
};

// Ô chọn bo góc dùng cho các bước khảo sát. Nhận `registration` như `<select>` cũ nên các bước giữ nguyên cách gọi.
const RegisteredSelect = ({ label, options = [], icon: Icon, error, registration, onChange }) => {
  const control = useContext(SelectControlContext);
  return (
    <div className="block">
      <span className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700">
        {Icon && <Icon size={16} className="text-orange-500" />}
        {label}
      </span>
      {control ? (
        <ControlledSelect
          control={control}
          registration={registration}
          onChange={onChange}
          label={label}
          options={options}
          placeholder={options[0]?.label}
        />
      ) : (
        <select
          {...registration}
          onChange={onChange || registration.onChange}
          className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-slate-800 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
        >
          {options.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      )}
      {error && <p className="mt-1 text-xs text-red-500">{error.message}</p>}
    </div>
  );
};

export default RegisteredSelect;
