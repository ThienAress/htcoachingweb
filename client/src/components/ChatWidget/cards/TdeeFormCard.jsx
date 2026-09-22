import { useCallback, useState } from "react";
import { Calculator, CircleAlert, Flame, Info } from "lucide-react";

import {
  isTdeeInputWithinLimits,
  recommendActivityBand,
  TDEE_INPUT_LIMITS,
  updateTrainingEvidence,
} from "../../../pages/TdeeCalculator/tdee.helpers";
import AssistantCard, {
  CardFooter,
  CardNotice,
  CardSection,
  CardSectionLabel,
} from "./AssistantCard";
import {
  ACTIVITIES,
  buildTdeeSubmitRequest,
  createTdeeFormState,
  EVIDENCE_FIELDS,
  EVIDENCE_OPTIONS,
  fieldClass,
  GENDERS,
  getTdeeFormErrors,
  GOALS,
} from "./tdeeForm.config";

export default function TdeeFormCard({ data, disabled = false, onSubmit }) {
  const [form, setForm] = useState(() => {
    const initial = createTdeeFormState(data?.prefill);
    return {
      ...initial,
      activityLevel: recommendActivityBand(initial)?.key || "",
    };
  });
  const [showErrors, setShowErrors] = useState(false);

  const handleChange = (key, value) =>
    setForm((current) => {
      const next = Object.hasOwn(EVIDENCE_OPTIONS, key)
        ? updateTrainingEvidence(current, key, value)
        : { ...current, [key]: value };
      if (Object.hasOwn(EVIDENCE_OPTIONS, key)) {
        next.activityLevel = recommendActivityBand(next)?.key || "";
      }
      return next;
    });

  const errors = getTdeeFormErrors(form);
  const isValid = Object.keys(errors).length === 0 && Boolean(form.activityLevel);

  const handleSubmit = useCallback(() => {
    if (!isValid) {
      setShowErrors(true);
      return;
    }
    onSubmit?.(buildTdeeSubmitRequest(form));
  }, [form, isValid, onSubmit]);

  const measurementError = (field, value, label) => {
    if (value === "" || isTdeeInputWithinLimits(field, value)) return null;
    const { min, max } = TDEE_INPUT_LIMITS[field];
    return `${label} phải từ ${min} đến ${max}.`;
  };

  return (
    <div className="chat-card-enter w-full">
      <AssistantCard
        eyebrow="TÍNH TDEE"
        icon={Calculator}
        subtitle="Dùng cả vận động hằng ngày, không chỉ số buổi tập"
        title="Thông tin cơ bản"
        footer={
          <CardFooter
            action={disabled ? "Đang xử lý..." : "Xác nhận & tính TDEE"}
            disabled={disabled}
            icon={Flame}
            note="Chỉ tính khi đủ dữ kiện bắt buộc"
            onClick={handleSubmit}
            primary
          />
        }
      >
        {Object.keys(data?.prefill || {}).length > 0 && (
          <CardSection>
            <CardNotice icon={Info}>
              Đã tự điền dữ kiện từ câu hỏi của bạn. Hãy kiểm tra và bổ sung các mục còn trống.
            </CardNotice>
          </CardSection>
        )}

        {showErrors && !isValid && (
          <CardSection>
            <CardNotice icon={CircleAlert} role="alert" tone="amber">
              Chưa thể tính TDEE vì còn thiếu hoặc có dữ liệu chưa hợp lệ. Vui lòng kiểm tra các mục được đánh dấu bên dưới.
            </CardNotice>
          </CardSection>
        )}

        <CardSection>
          <div className="grid grid-cols-1 gap-4 min-[430px]:grid-cols-2">
            <fieldset>
              <legend className="mb-2 text-xs font-medium text-slate-500 dark:text-zinc-400">
                Giới tính
              </legend>
              <div className="grid grid-cols-2 gap-2" role="group" aria-label="Giới tính">
                {GENDERS.map(({ value, label }) => (
                  <button
                    aria-pressed={form.gender === value}
                    disabled={disabled}
                    className={`min-h-11 rounded-xl border px-3 py-2 text-[13px] font-medium transition-[border-color,color,background-color] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 motion-reduce:transition-none ${
                      form.gender === value
                        ? "border-emerald-600 bg-emerald-50 text-emerald-700 dark:border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300"
                        : "border-slate-200 text-slate-600 hover:border-emerald-500 dark:border-white/10 dark:text-zinc-300 dark:hover:border-emerald-400"
                    }`}
                    key={value}
                    onClick={() => handleChange("gender", value)}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>
              {showErrors && errors.gender && (
                <span className="mt-1 block text-xs text-rose-700 dark:text-rose-300" role="alert">
                  {errors.gender}
                </span>
              )}
            </fieldset>

            <NumberField
              disabled={disabled}
              error={showErrors ? errors.age : measurementError("age", form.age, "Tuổi")}
              field="age"
              label="Tuổi"
              onChange={handleChange}
              placeholder="28"
              value={form.age}
            />
            <NumberField
              disabled={disabled}
              error={showErrors ? errors.heightCm : measurementError("heightCm", form.heightCm, "Chiều cao")}
              field="heightCm"
              label="Chiều cao (cm)"
              onChange={handleChange}
              placeholder="175"
              value={form.heightCm}
            />
            <NumberField
              disabled={disabled}
              error={showErrors ? errors.weightKg : measurementError("weightKg", form.weightKg, "Cân nặng")}
              field="weightKg"
              label="Cân nặng (kg)"
              onChange={handleChange}
              placeholder="78"
              value={form.weightKg}
            />

            {EVIDENCE_FIELDS.map(([key, label]) => (
              <label className={key === "trainingIntensity" ? "min-[430px]:col-span-2" : ""} key={key}>
                <span className="mb-2 block text-xs font-medium text-slate-500 dark:text-zinc-400">
                  {label}
                </span>
                <select
                  aria-invalid={Boolean(showErrors && errors[key])}
                  aria-label={label}
                  autoComplete="off"
                  className={fieldClass}
                  disabled={
                    disabled ||
                    (["trainingDuration", "trainingIntensity"].includes(key) &&
                      form.trainingFrequency === "none")
                  }
                  onChange={(event) => handleChange(key, event.target.value)}
                  name={key}
                  value={form[key]}
                >
                  {EVIDENCE_OPTIONS[key].map(([value, optionLabel]) => (
                    <option key={value} value={value}>
                      {optionLabel}
                    </option>
                  ))}
                </select>
                {showErrors && errors[key] && (
                  <span className="mt-1 block text-xs text-rose-700 dark:text-rose-300" role="alert">
                    {errors[key]}
                  </span>
                )}
              </label>
            ))}
          </div>
        </CardSection>

        <CardSection>
          <CardSectionLabel>Khoảng hệ số đề xuất</CardSectionLabel>
          <select
            aria-label="Khoảng hệ số đề xuất"
            className={fieldClass}
            disabled
            name="activityLevel"
            value={form.activityLevel}
          >
            {ACTIVITIES.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs leading-5 text-cyan-800 dark:text-cyan-100">
            Dùng toàn bộ vận động cả ngày; số buổi tập riêng lẻ không quyết định hệ số.
          </p>
        </CardSection>

        <CardSection>
          <CardSectionLabel>Mục tiêu</CardSectionLabel>
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Mục tiêu">
            {GOALS.map(({ value, label }) => (
              <button
                aria-pressed={form.goal === value}
                disabled={disabled}
                className={`min-h-11 rounded-xl border px-2 py-2 text-[13px] font-medium transition-[border-color,color,background-color] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 motion-reduce:transition-none ${
                  form.goal === value
                    ? "border-emerald-600 bg-emerald-50 text-emerald-700 dark:border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300"
                    : "border-slate-200 text-slate-600 hover:border-emerald-500 dark:border-white/10 dark:text-zinc-300 dark:hover:border-emerald-400"
                }`}
                key={value}
                onClick={() => handleChange("goal", value)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
          {showErrors && errors.goal && (
            <span className="mt-1 block text-xs text-rose-700 dark:text-rose-300" role="alert">
              {errors.goal}
            </span>
          )}
        </CardSection>
      </AssistantCard>
    </div>
  );
}

function NumberField({ disabled, error, field, label, onChange, placeholder, value }) {
  const limits = TDEE_INPUT_LIMITS[field];

  return (
    <label>
      <span className="mb-2 block text-xs font-medium text-slate-500 dark:text-zinc-400">
        {label}
      </span>
      <input
        aria-invalid={Boolean(error)}
        autoComplete="off"
        className={fieldClass}
        disabled={disabled}
        inputMode="numeric"
        max={limits.max}
        min={limits.min}
        name={field}
        onChange={(event) => onChange(field, event.target.value)}
        placeholder={placeholder}
        step="1"
        type="number"
        value={value}
      />
      {error && (
        <span className="mt-1 block text-xs text-rose-700 dark:text-rose-300" role="alert">
          {error}
        </span>
      )}
    </label>
  );
}
