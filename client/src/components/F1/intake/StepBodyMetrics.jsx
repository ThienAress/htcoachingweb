// StepBodyMetrics.jsx
import { Ruler, Weight, Activity, Heart, TrendingUp } from "lucide-react";

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

const InfoCard = ({ label, value, icon: Icon }) => {
  return (
    <div className="rounded-xl border border-slate-100 bg-gradient-to-br from-slate-50 to-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-slate-500">
        {Icon && <Icon size={16} className="text-amber-500" />}
        <p className="text-xs font-medium uppercase tracking-wider">{label}</p>
      </div>
      <p className="mt-1.5 text-2xl font-bold text-slate-800">
        {value || "--"}
      </p>
    </div>
  );
};

const StepBodyMetrics = ({ value, bmi, waistHipRatio, onChange }) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 border-l-4 border-amber-500 pl-3">
        <Activity size={20} className="text-amber-600" />
        <div>
          <h3 className="text-xl font-bold text-slate-800">Chỉ số cơ thể</h3>
          <p className="text-sm text-slate-500">
            Nhập các số đo để hệ thống tính BMI và tỷ lệ eo/hông tự động.
          </p>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Field
          label="Chiều cao (cm)"
          icon={Ruler}
          type="number"
          value={value.heightCm}
          onChange={(e) => onChange("heightCm", e.target.value)}
          placeholder="Ví dụ: 170"
        />
        <Field
          label="Cân nặng (kg)"
          icon={Weight}
          type="number"
          value={value.weightKg}
          onChange={(e) => onChange("weightKg", e.target.value)}
          placeholder="Ví dụ: 65"
        />
        <Field
          label="% Body fat"
          icon={TrendingUp}
          type="number"
          value={value.bodyFatPercent}
          onChange={(e) => onChange("bodyFatPercent", e.target.value)}
          placeholder="Ví dụ: 18"
        />
        <Field
          label="Vòng eo (cm)"
          icon={Ruler}
          type="number"
          value={value.waistCm}
          onChange={(e) => onChange("waistCm", e.target.value)}
          placeholder="Ví dụ: 75"
        />
        <Field
          label="Vòng hông (cm)"
          icon={Ruler}
          type="number"
          value={value.hipCm}
          onChange={(e) => onChange("hipCm", e.target.value)}
          placeholder="Ví dụ: 90"
        />
        <Field
          label="Nhịp tim nghỉ"
          icon={Heart}
          type="number"
          value={value.restingHeartRate}
          onChange={(e) => onChange("restingHeartRate", e.target.value)}
          placeholder="Ví dụ: 72"
        />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <InfoCard label="BMI" value={bmi || "--"} icon={Activity} />
        <InfoCard
          label="Waist / Hip Ratio"
          value={waistHipRatio || "--"}
          icon={TrendingUp}
        />
      </div>
    </div>
  );
};

export default StepBodyMetrics;
