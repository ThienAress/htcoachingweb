const Field = ({ label, required, ...props }) => {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">
        {label} {required ? <span className="text-red-500">*</span> : null}
      </span>
      <input
        {...props}
        className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-400"
      />
    </label>
  );
};

const SelectField = ({ label, options = [], ...props }) => {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </span>
      <select
        {...props}
        className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-400"
      >
        {options.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  );
};

const StepCustomerInfo = ({ value, onChange }) => {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Field
        label="Họ và tên"
        value={value.fullName}
        onChange={(e) => onChange("fullName", e.target.value)}
        required
      />
      <Field
        label="Tuổi"
        type="number"
        value={value.age}
        onChange={(e) => onChange("age", e.target.value)}
        required
      />
      <SelectField
        label="Giới tính"
        value={value.gender}
        onChange={(e) => onChange("gender", e.target.value)}
        options={[
          { label: "Chọn giới tính", value: "" },
          { label: "Nam", value: "male" },
          { label: "Nữ", value: "female" },
          { label: "Khác", value: "other" },
        ]}
      />
      <Field
        label="Nghề nghiệp"
        value={value.occupation}
        onChange={(e) => onChange("occupation", e.target.value)}
      />
      <Field
        label="Số điện thoại"
        value={value.phone}
        onChange={(e) => onChange("phone", e.target.value)}
      />
      <Field
        label="Email"
        value={value.email}
        onChange={(e) => onChange("email", e.target.value)}
      />
    </div>
  );
};

export default StepCustomerInfo;
