const Field = ({ label, ...props }) => {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
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

const TextArea = ({ label, ...props }) => {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </span>
      <textarea
        {...props}
        rows={4}
        className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-400"
      />
    </label>
  );
};

const SwitchRow = ({ label, checked, onChange }) => {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-4">
      <span className="text-sm font-medium text-slate-800">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-14 rounded-full transition ${
          checked ? "bg-emerald-500" : "bg-slate-300"
        }`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${
            checked ? "left-8" : "left-1"
          }`}
        />
      </button>
    </div>
  );
};

const StepLifestyleNutrition = ({ value, onChange }) => {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Field
        label="Bao nhiêu bữa/ngày"
        type="number"
        value={value.mealsPerDay}
        onChange={(e) => onChange("mealsPerDay", e.target.value)}
      />
      <Field
        label="Ngủ bao nhiêu tiếng/ngày"
        type="number"
        value={value.sleepHours}
        onChange={(e) => onChange("sleepHours", e.target.value)}
      />

      <SelectField
        label="Mức độ căng thẳng"
        value={value.stressLevel}
        onChange={(e) => onChange("stressLevel", e.target.value)}
        options={[
          { label: "Chọn mức độ căng thẳng", value: "" },
          { label: "Thấp", value: "low" },
          { label: "Vừa", value: "medium" },
          { label: "Cao", value: "high" },
        ]}
      />

      <SelectField
        label="Mức độ vận động trong công việc"
        value={value.workActivityLevel}
        onChange={(e) => onChange("workActivityLevel", e.target.value)}
        options={[
          { label: "Chọn mức độ vận động", value: "" },
          { label: "Ngồi nhiều", value: "sedentary" },
          { label: "Đứng nhiều", value: "standing" },
          { label: "Di chuyển nhiều", value: "active" },
          { label: "Lao động nặng", value: "heavy_labor" },
        ]}
      />

      <SwitchRow
        label="Có thường ăn ngoài không?"
        checked={value.usuallyEatOut}
        onChange={(checked) => onChange("usuallyEatOut", checked)}
      />

      <SwitchRow
        label="Có uống đủ nước không?"
        checked={value.drinkEnoughWater}
        onChange={(checked) => onChange("drinkEnoughWater", checked)}
      />

      <div className="md:col-span-2">
        <TextArea
          label="Dị ứng thực phẩm"
          value={value.foodAllergies}
          onChange={(e) => onChange("foodAllergies", e.target.value)}
        />
      </div>
    </div>
  );
};

export default StepLifestyleNutrition;
