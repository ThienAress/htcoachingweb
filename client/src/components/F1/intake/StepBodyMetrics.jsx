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

const InfoCard = ({ label, value }) => {
  return (
    <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-slate-900">{value}</p>
    </div>
  );
};

const StepBodyMetrics = ({ value, bmi, waistHipRatio, onChange }) => {
  return (
    <div className="space-y-5">
      <div className="grid md:grid-cols-2 gap-4">
        <Field
          label="Chiều cao (cm)"
          type="number"
          value={value.heightCm}
          onChange={(e) => onChange("heightCm", e.target.value)}
        />
        <Field
          label="Cân nặng (kg)"
          type="number"
          value={value.weightKg}
          onChange={(e) => onChange("weightKg", e.target.value)}
        />
        <Field
          label="% Body fat"
          type="number"
          value={value.bodyFatPercent}
          onChange={(e) => onChange("bodyFatPercent", e.target.value)}
        />
        <Field
          label="Vòng eo (cm)"
          type="number"
          value={value.waistCm}
          onChange={(e) => onChange("waistCm", e.target.value)}
        />
        <Field
          label="Vòng hông (cm)"
          type="number"
          value={value.hipCm}
          onChange={(e) => onChange("hipCm", e.target.value)}
        />
        <Field
          label="Nhịp tim nghỉ"
          type="number"
          value={value.restingHeartRate}
          onChange={(e) => onChange("restingHeartRate", e.target.value)}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <InfoCard label="BMI" value={bmi || "--"} />
        <InfoCard label="Waist / Hip Ratio" value={waistHipRatio || "--"} />
      </div>
    </div>
  );
};

export default StepBodyMetrics;
