// StepLifestyleNutrition.jsx
import {
  Utensils,
  Moon,
  Brain,
  Briefcase,
  Droplets,
  Apple,
} from "lucide-react";

const Field = ({ label, icon: Icon, ...props }) => {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700">
        {Icon && <Icon size={16} className="text-amber-500" />}
        {label}
      </span>
      <input
        {...props}
        className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-slate-800 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
      />
    </label>
  );
};

const SelectField = ({ label, options = [], icon: Icon, ...props }) => {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700">
        {Icon && <Icon size={16} className="text-amber-500" />}
        {label}
      </span>
      <select
        {...props}
        className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-slate-800 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
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

const TextArea = ({ label, icon: Icon, ...props }) => {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700">
        {Icon && <Icon size={16} className="text-amber-500" />}
        {label}
      </span>
      <textarea
        {...props}
        rows={4}
        className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-slate-800 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
      />
    </label>
  );
};

const SwitchRow = ({ label, checked, onChange, icon: Icon }) => {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {Icon && <Icon size={18} className="text-amber-500" />}
          <span className="text-sm font-bold text-slate-800">{label}</span>
        </div>
        <button
          type="button"
          onClick={() => onChange(!checked)}
          className={`relative h-7 w-14 rounded-full transition ${
            checked ? "bg-amber-500" : "bg-slate-300"
          }`}
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${
              checked ? "left-8" : "left-1"
            }`}
          />
        </button>
      </div>
    </div>
  );
};

const StepLifestyleNutrition = ({ value, onChange }) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 border-l-4 border-amber-500 pl-3">
        <Utensils size={20} className="text-amber-600" />
        <div>
          <h3 className="text-xl font-bold text-slate-800">
            Lối sống & Dinh dưỡng
          </h3>
          <p className="text-sm text-slate-500">
            Thông tin về thói quen sinh hoạt và ăn uống.
          </p>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Field
          label="Bao nhiêu bữa/ngày"
          icon={Utensils}
          type="number"
          value={value.mealsPerDay}
          onChange={(e) => onChange("mealsPerDay", e.target.value)}
          placeholder="Ví dụ: 3"
        />
        <Field
          label="Ngủ bao nhiêu tiếng/ngày"
          icon={Moon}
          type="number"
          value={value.sleepHours}
          onChange={(e) => onChange("sleepHours", e.target.value)}
          placeholder="Ví dụ: 7"
        />

        <SelectField
          label="Mức độ căng thẳng"
          icon={Brain}
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
          icon={Briefcase}
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
          icon={Utensils}
          checked={value.usuallyEatOut}
          onChange={(checked) => onChange("usuallyEatOut", checked)}
        />

        <SwitchRow
          label="Có uống đủ nước không?"
          icon={Droplets}
          checked={value.drinkEnoughWater}
          onChange={(checked) => onChange("drinkEnoughWater", checked)}
        />

        <div className="md:col-span-2">
          <TextArea
            label="Dị ứng thực phẩm"
            icon={Apple}
            value={value.foodAllergies}
            onChange={(e) => onChange("foodAllergies", e.target.value)}
            placeholder="Ví dụ: hải sản, đậu phộng, sữa..."
          />
        </div>
      </div>
    </div>
  );
};

export default StepLifestyleNutrition;
