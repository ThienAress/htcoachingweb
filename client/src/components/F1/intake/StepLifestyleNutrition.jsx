// StepLifestyleNutrition.jsx
import {
  Utensils,
  Moon,
  Brain,
  Briefcase,
  Droplets,
  Apple,
} from "lucide-react";

const Field = ({ label, icon: Icon, error, registration, ...props }) => {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700">
        {Icon && <Icon size={16} className="text-orange-500" />}
        {label}
      </span>
      <input
        {...registration}
        {...props}
        className={`w-full rounded-lg border bg-white px-4 py-2.5 text-slate-800 outline-none transition focus:ring-2 ${
          error
            ? "border-red-400 focus:border-red-400 focus:ring-red-100"
            : "border-slate-200 focus:border-orange-400 focus:ring-orange-100"
        }`}
      />
      {error && <p className="mt-1 text-xs text-red-500">{error.message}</p>}
    </label>
  );
};

const SelectField = ({ label, options = [], icon: Icon, error, registration, ...props }) => {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700">
        {Icon && <Icon size={16} className="text-orange-500" />}
        {label}
      </span>
      <select
        {...registration}
        {...props}
        className={`w-full rounded-lg border bg-white px-4 py-2.5 text-slate-800 outline-none transition focus:ring-2 ${
          error
            ? "border-red-400 focus:border-red-400 focus:ring-red-100"
            : "border-slate-200 focus:border-orange-400 focus:ring-orange-100"
        }`}
      >
        {options.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-red-500">{error.message}</p>}
    </label>
  );
};

const TextArea = ({ label, icon: Icon, error, registration, ...props }) => {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700">
        {Icon && <Icon size={16} className="text-orange-500" />}
        {label}
      </span>
      <textarea
        {...registration}
        {...props}
        rows={4}
        className={`w-full rounded-lg border bg-white px-4 py-2.5 text-slate-800 outline-none transition focus:ring-2 ${
          error
            ? "border-red-400 focus:border-red-400 focus:ring-red-100"
            : "border-slate-200 focus:border-orange-400 focus:ring-orange-100"
        }`}
      />
      {error && <p className="mt-1 text-xs text-red-500">{error.message}</p>}
    </label>
  );
};

const SwitchRow = ({ label, checked, onChange, icon: Icon }) => {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {Icon && <Icon size={18} className="text-orange-500" />}
          <span className="text-sm font-bold text-slate-800">{label}</span>
        </div>
        <button
          type="button"
          onClick={() => onChange(!checked)}
          className={`relative h-7 w-14 rounded-full transition ${
            checked ? "bg-orange-500" : "bg-slate-300"
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

const StepLifestyleNutrition = ({ register, watch, setValue, errors }) => {
  const usuallyEatOut = watch("lifestyleNutrition.usuallyEatOut");
  const drinkEnoughWater = watch("lifestyleNutrition.drinkEnoughWater");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 border-l-4 border-orange-500 pl-3">
        <Utensils size={20} className="text-orange-600" />
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
          registration={register("lifestyleNutrition.mealsPerDay")}
          error={errors?.lifestyleNutrition?.mealsPerDay}
          placeholder="Ví dụ: 3"
        />
        <Field
          label="Ngủ bao nhiêu tiếng/ngày"
          icon={Moon}
          type="number"
          registration={register("lifestyleNutrition.sleepHours")}
          error={errors?.lifestyleNutrition?.sleepHours}
          placeholder="Ví dụ: 7"
        />

        <SelectField
          label="Mức độ căng thẳng"
          icon={Brain}
          registration={register("lifestyleNutrition.stressLevel")}
          error={errors?.lifestyleNutrition?.stressLevel}
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
          registration={register("lifestyleNutrition.workActivityLevel")}
          error={errors?.lifestyleNutrition?.workActivityLevel}
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
          checked={usuallyEatOut}
          onChange={(checked) => setValue("lifestyleNutrition.usuallyEatOut", checked, { shouldValidate: true })}
        />

        <SwitchRow
          label="Có uống đủ nước không?"
          icon={Droplets}
          checked={drinkEnoughWater}
          onChange={(checked) => setValue("lifestyleNutrition.drinkEnoughWater", checked, { shouldValidate: true })}
        />

        <div className="md:col-span-2">
          <TextArea
            label="Dị ứng thực phẩm"
            icon={Apple}
            registration={register("lifestyleNutrition.foodAllergies")}
            error={errors?.lifestyleNutrition?.foodAllergies}
            placeholder="Ví dụ: hải sản, đậu phộng, sữa..."
          />
        </div>
      </div>
    </div>
  );
};

export default StepLifestyleNutrition;
