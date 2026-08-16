import { useState, useCallback } from "react";
import { Flame, Calculator } from "lucide-react";
import {
  isTdeeInputWithinLimits,
  recommendActivityBand,
  TDEE_INPUT_LIMITS,
  updateTrainingEvidence,
} from "../../../pages/TdeeCalculator/tdee.helpers";

const GENDERS = [
  { value: "male", label: "Nam" },
  { value: "female", label: "Nữ" },
];

const ACTIVITIES = [
  { value: "", label: "Chọn sau khi khai báo vận động" },
  { value: "sedentary", label: "Ít vận động cả ngày (1,2)" },
  { value: "light", label: "Vận động nhẹ cả ngày (1,4)" },
  { value: "moderate", label: "Vận động vừa cả ngày (1,55)" },
  { value: "active", label: "Vận động nhiều cả ngày (1,7)" },
  { value: "very_active", label: "Vận động rất nhiều cả ngày (1,85)" },
];

const EVIDENCE_OPTIONS = {
  dailyMovement: [
    ["", "Chọn"], ["mostly_seated", "Chủ yếu ngồi"], ["mixed", "Ngồi/đi lại xen kẽ"],
    ["mostly_moving", "Đi lại phần lớn ngày"], ["physical_work", "Lao động thể chất"],
  ],
  steps: [
    ["", "Chọn"], ["under_5000", "Dưới 5.000"], ["between_5000_7999", "5.000–7.999"],
    ["between_8000_11999", "8.000–11.999"], ["at_least_12000", "Từ 12.000"],
  ],
  trainingFrequency: [
    ["", "Chọn"], ["none", "Không tập"], ["one_two", "1–2 buổi"],
    ["three_four", "3–4 buổi"], ["five_plus", "Từ 5 buổi"],
  ],
  trainingDuration: [
    ["", "Chọn"], ["none", "Không áp dụng"], ["under_30", "Dưới 30 phút"], ["between_30_45", "30–45 phút"],
    ["between_45_60", "45–60 phút"], ["over_60", "Trên 60 phút"],
  ],
  trainingIntensity: [
    ["", "Chọn"], ["none", "Không áp dụng"], ["easy", "Nhẹ"], ["moderate", "Vừa"], ["vigorous", "Cao"],
  ],
};

const GOALS = [
  { value: "fat_loss", label: "🔥 Giảm mỡ" },
  { value: "maintenance", label: "⚖️ Duy trì" },
  { value: "muscle_gain", label: "💪 Tăng cơ" },
];

export default function TdeeFormCard({ onSubmit }) {
  const [form, setForm] = useState({
    gender: "",
    age: "",
    heightCm: "",
    weightKg: "",
    activityLevel: "",
    dailyMovement: "",
    steps: "",
    trainingFrequency: "",
    trainingDuration: "",
    trainingIntensity: "",
    goal: "",
  });

  const handleChange = (key, val) => setForm((prev) => {
    const next = Object.hasOwn(EVIDENCE_OPTIONS, key)
      ? updateTrainingEvidence(prev, key, val)
      : { ...prev, [key]: val };
    if (Object.hasOwn(EVIDENCE_OPTIONS, key)) {
      next.activityLevel = recommendActivityBand(next)?.key || "";
    }
    return next;
  });

  const handleSubmit = useCallback(() => {
    const { gender, age, heightCm, weightKg, activityLevel, goal } = form;
    if (
      !Object.values(form).every(Boolean) ||
      !isTdeeInputWithinLimits("age", age) ||
      !isTdeeInputWithinLimits("heightCm", heightCm) ||
      !isTdeeInputWithinLimits("weightKg", weightKg)
    ) return;

    const evidenceLabel = (key, value) => EVIDENCE_OPTIONS[key]
      .find(([optionValue]) => optionValue === value)?.[1];
    const text = `Tính TDEE: ${gender === "male" ? "Nam" : "Nữ"}, ${age} tuổi, ${heightCm}cm, ${weightKg}kg, ${
      ACTIVITIES.find((a) => a.value === activityLevel)?.label
    }, vận động ngoài buổi tập: ${evidenceLabel("dailyMovement", form.dailyMovement)}, ` +
      `số bước: ${form.steps === "under_5000" ? "4000" : form.steps === "between_5000_7999" ? "6500" : form.steps === "between_8000_11999" ? "10000" : "12000"} bước/ngày, ` +
      `tập ${form.trainingFrequency === "none" ? "0" : form.trainingFrequency === "one_two" ? "2" : form.trainingFrequency === "three_four" ? "4" : "5"} buổi/tuần, ` +
      `${form.trainingDuration === "none" ? "0" : form.trainingDuration === "under_30" ? "20" : form.trainingDuration === "between_30_45" ? "40" : form.trainingDuration === "between_45_60" ? "50" : "70"} phút/buổi, ` +
      `cường độ ${evidenceLabel("trainingIntensity", form.trainingIntensity)}, mục tiêu ${GOALS.find((g) => g.value === goal)?.label}`;

    onSubmit?.(text);
  }, [form, onSubmit]);

  const isValid =
    Object.values(form).every(Boolean) &&
    isTdeeInputWithinLimits("age", form.age) &&
    isTdeeInputWithinLimits("heightCm", form.heightCm) &&
    isTdeeInputWithinLimits("weightKg", form.weightKg);

  const measurementError = (field, value, label) => {
    if (value === "" || isTdeeInputWithinLimits(field, value)) return null;
    const { min, max } = TDEE_INPUT_LIMITS[field];
    return `${label} phải từ ${min} đến ${max}.`;
  };

  const selectClass = "w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-colors appearance-none";
  const inputClass = "w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

  return (
    <div className="bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20 rounded-xl p-4 space-y-3 w-full chat-card-enter">
      <div className="flex items-center gap-2 mb-1">
        <Calculator size={16} className="text-emerald-400" />
        <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Tính TDEE</span>
      </div>

      {/* Row 1: Gender + Age */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <span className="text-[10px] text-gray-400 uppercase mb-1 block">Giới tính</span>
          <div className="flex gap-1" role="group" aria-label="Giới tính">
            {GENDERS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => handleChange("gender", value)}
                aria-pressed={form.gender === value}
                className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors duration-150 motion-reduce:transition-none ${
                  form.gender === value
                    ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
                    : "border-white/10 text-gray-400 hover:border-white/20"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label htmlFor="chat-tdee-age" className="text-[10px] text-gray-400 uppercase mb-1 block">Tuổi</label>
          <input
            id="chat-tdee-age"
            type="number"
            min={TDEE_INPUT_LIMITS.age.min}
            max={TDEE_INPUT_LIMITS.age.max}
            step="1"
            value={form.age}
            onChange={(e) => handleChange("age", e.target.value)}
            placeholder="25"
            aria-invalid={Boolean(measurementError("age", form.age, "Tuổi"))}
            className={inputClass}
          />
          {measurementError("age", form.age, "Tuổi") && (
            <p className="mt-1 text-[11px] text-rose-300" role="alert">
              {measurementError("age", form.age, "Tuổi")}
            </p>
          )}
        </div>
      </div>

      {/* Row 2: Height + Weight */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="chat-tdee-height" className="text-[10px] text-gray-400 uppercase mb-1 block">Chiều cao (cm)</label>
          <input
            id="chat-tdee-height"
            type="number"
            min={TDEE_INPUT_LIMITS.heightCm.min}
            max={TDEE_INPUT_LIMITS.heightCm.max}
            value={form.heightCm}
            onChange={(e) => handleChange("heightCm", e.target.value)}
            placeholder="170"
            aria-invalid={Boolean(measurementError("heightCm", form.heightCm, "Chiều cao"))}
            className={inputClass}
          />
          {measurementError("heightCm", form.heightCm, "Chiều cao") && (
            <p className="mt-1 text-[11px] text-rose-300" role="alert">
              {measurementError("heightCm", form.heightCm, "Chiều cao")}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="chat-tdee-weight" className="text-[10px] text-gray-400 uppercase mb-1 block">Cân nặng (kg)</label>
          <input
            id="chat-tdee-weight"
            type="number"
            min={TDEE_INPUT_LIMITS.weightKg.min}
            max={TDEE_INPUT_LIMITS.weightKg.max}
            value={form.weightKg}
            onChange={(e) => handleChange("weightKg", e.target.value)}
            placeholder="70"
            aria-invalid={Boolean(measurementError("weightKg", form.weightKg, "Cân nặng"))}
            className={inputClass}
          />
          {measurementError("weightKg", form.weightKg, "Cân nặng") && (
            <p className="mt-1 text-[11px] text-rose-300" role="alert">
              {measurementError("weightKg", form.weightKg, "Cân nặng")}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {[
          ["dailyMovement", "Vận động ngoài buổi tập"],
          ["steps", "Số bước trung bình"],
          ["trainingFrequency", "Số buổi mỗi tuần"],
          ["trainingDuration", "Thời lượng mỗi buổi"],
        ].map(([key, label]) => (
          <div key={key}>
            <label htmlFor={`chat-tdee-${key}`} className="text-[10px] text-gray-400 uppercase mb-1 block">{label}</label>
            <select
              id={`chat-tdee-${key}`}
              value={form[key]}
              onChange={(e) => handleChange(key, e.target.value)}
              aria-label={label}
              disabled={key === "trainingDuration" && form.trainingFrequency === "none"}
              className={`${selectClass} disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {EVIDENCE_OPTIONS[key].map(([value, optionLabel]) => <option key={value} value={value}>{optionLabel}</option>)}
            </select>
          </div>
        ))}
      </div>
      <div>
        <label htmlFor="chat-tdee-training-intensity" className="text-[10px] text-gray-400 uppercase mb-1 block">Cường độ buổi tập</label>
        <select
          id="chat-tdee-training-intensity"
          value={form.trainingIntensity}
          onChange={(e) => handleChange("trainingIntensity", e.target.value)}
          aria-label="Cường độ buổi tập"
          disabled={form.trainingFrequency === "none"}
          className={`${selectClass} disabled:cursor-not-allowed disabled:opacity-60`}
        >
          {EVIDENCE_OPTIONS.trainingIntensity.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>

      <div>
        <label htmlFor="chat-tdee-activity-band" className="text-[10px] text-gray-400 uppercase mb-1 block">Khoảng hệ số đề xuất</label>
        <select
          id="chat-tdee-activity-band"
          value={form.activityLevel}
          disabled
          className={selectClass}
        >
          {ACTIVITIES.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>
      <p className="text-[11px] leading-5 text-cyan-100/80">
        Dùng toàn bộ vận động cả ngày; số buổi tập riêng lẻ không quyết định hệ số.
      </p>

      {/* Row 4: Goal */}
      <div>
        <span className="text-[10px] text-gray-400 uppercase mb-1 block">Mục tiêu</span>
        <div className="flex gap-1.5" role="group" aria-label="Mục tiêu">
          {GOALS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => handleChange("goal", value)}
              aria-pressed={form.goal === value}
              className={`flex-1 py-2 text-[11px] rounded-lg border transition-colors duration-150 motion-reduce:transition-none ${
                form.goal === value
                  ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
                  : "border-white/10 text-gray-400 hover:border-white/20"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!isValid}
        className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-600 text-white text-sm font-semibold hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity duration-150 motion-reduce:transition-none flex items-center justify-center gap-2"
      >
        <Flame size={14} />
        Tính TDEE
      </button>
    </div>
  );
}
