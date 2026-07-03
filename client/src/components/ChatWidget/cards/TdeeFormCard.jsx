import { useState, useCallback } from "react";
import { Flame, Calculator } from "lucide-react";

const GENDERS = [
  { value: "male", label: "Nam" },
  { value: "female", label: "Nữ" },
];

const ACTIVITIES = [
  { value: "sedentary", label: "Ít vận động" },
  { value: "light", label: "Tập nhẹ 1-3 ngày" },
  { value: "moderate", label: "Tập 3-5 ngày" },
  { value: "active", label: "Tập 6-7 ngày" },
  { value: "very_active", label: "Tập rất nặng" },
];

const GOALS = [
  { value: "fat_loss", label: "🔥 Giảm mỡ" },
  { value: "maintenance", label: "⚖️ Duy trì" },
  { value: "muscle_gain", label: "💪 Tăng cơ" },
];

export default function TdeeFormCard({ onSubmit }) {
  const [form, setForm] = useState({
    gender: "male",
    age: "",
    heightCm: "",
    weightKg: "",
    activityLevel: "moderate",
    goal: "fat_loss",
  });

  const handleChange = (key, val) => setForm((prev) => ({ ...prev, [key]: val }));

  const handleSubmit = useCallback(() => {
    const { gender, age, heightCm, weightKg, activityLevel, goal } = form;
    if (!age || !heightCm || !weightKg) return;

    const text = `Tính TDEE: ${gender === "male" ? "Nam" : "Nữ"}, ${age} tuổi, ${heightCm}cm, ${weightKg}kg, ${
      ACTIVITIES.find((a) => a.value === activityLevel)?.label
    }, mục tiêu ${GOALS.find((g) => g.value === goal)?.label}`;

    onSubmit?.(text);
  }, [form, onSubmit]);

  const isValid = form.age && form.heightCm && form.weightKg;

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
          <label className="text-[10px] text-gray-400 uppercase mb-1 block">Giới tính</label>
          <div className="flex gap-1">
            {GENDERS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => handleChange("gender", value)}
                className={`flex-1 py-1.5 text-xs rounded-lg border transition-all ${
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
          <label className="text-[10px] text-gray-400 uppercase mb-1 block">Tuổi</label>
          <input
            type="number"
            value={form.age}
            onChange={(e) => handleChange("age", e.target.value)}
            placeholder="25"
            className={inputClass}
          />
        </div>
      </div>

      {/* Row 2: Height + Weight */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-gray-400 uppercase mb-1 block">Chiều cao (cm)</label>
          <input
            type="number"
            value={form.heightCm}
            onChange={(e) => handleChange("heightCm", e.target.value)}
            placeholder="170"
            className={inputClass}
          />
        </div>
        <div>
          <label className="text-[10px] text-gray-400 uppercase mb-1 block">Cân nặng (kg)</label>
          <input
            type="number"
            value={form.weightKg}
            onChange={(e) => handleChange("weightKg", e.target.value)}
            placeholder="70"
            className={inputClass}
          />
        </div>
      </div>

      {/* Row 3: Activity */}
      <div>
        <label className="text-[10px] text-gray-400 uppercase mb-1 block">Mức vận động</label>
        <select
          value={form.activityLevel}
          onChange={(e) => handleChange("activityLevel", e.target.value)}
          className={selectClass}
        >
          {ACTIVITIES.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {/* Row 4: Goal */}
      <div>
        <label className="text-[10px] text-gray-400 uppercase mb-1 block">Mục tiêu</label>
        <div className="flex gap-1.5">
          {GOALS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => handleChange("goal", value)}
              className={`flex-1 py-2 text-[11px] rounded-lg border transition-all ${
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
        className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-600 text-white text-sm font-semibold hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
      >
        <Flame size={14} />
        Tính TDEE
      </button>
    </div>
  );
}
