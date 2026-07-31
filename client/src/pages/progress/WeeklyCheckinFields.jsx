import { getAdherenceLevel } from "./weeklyCheckinForm";

const inputClass =
  "mt-2 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-white outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/30 disabled:opacity-50";
const textareaClass =
  "mt-2 min-h-24 w-full resize-y rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/30 disabled:opacity-50";

const NumericField = ({
  id,
  label,
  register,
  disabled,
  step = "1",
  min,
  max,
}) => (
  <label htmlFor={id} className="block text-sm font-medium text-slate-300">
    {label}
    <input
      id={id}
      type="number"
      inputMode="decimal"
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      {...register(id)}
      className={inputClass}
    />
  </label>
);

const adherenceLevels = [
  { range: "1–3", label: "Cần hỗ trợ thêm" },
  { range: "4–6", label: "Chưa ổn định" },
  { range: "7–8", label: "Bám khá tốt" },
  { range: "9–10", label: "Bám rất tốt" },
];

const AdherenceGuide = ({ score }) => {
  const selectedLevel = getAdherenceLevel(score);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <p className="text-sm text-slate-300">
        Mức hiện tại:{" "}
        <strong className="text-orange-300">
          {selectedLevel
            ? `${selectedLevel.label} (${selectedLevel.range} điểm)`
            : "Chưa đánh giá"}
        </strong>
      </p>
      <div className="mt-3 grid gap-2 text-xs text-slate-400 sm:grid-cols-2 lg:grid-cols-4">
        {adherenceLevels.map((level) => (
          <span key={level.range}>
            <strong className="text-slate-300">{level.range}:</strong>{" "}
            {level.label}
          </span>
        ))}
      </div>
    </div>
  );
};

export const WeeklyCheckinFields = ({
  register,
  errors,
  disabled,
  adherence,
}) => (
  <>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <NumericField
        id="weightKg"
        label="Cân nặng (kg)"
        register={register}
        disabled={disabled}
        min="30"
        max="350"
        step="0.1"
      />
      <NumericField
        id="waistCm"
        label="Vòng eo (cm)"
        register={register}
        disabled={disabled}
        min="30"
        max="300"
        step="0.1"
      />
      <NumericField
        id="energy"
        label="Năng lượng (1–10)"
        register={register}
        disabled={disabled}
        min="1"
        max="10"
      />
      <NumericField
        id="adherence"
        label="Mức độ bám kế hoạch (1–10)"
        register={register}
        disabled={disabled}
        min="1"
        max="10"
      />
    </div>
    <AdherenceGuide score={adherence} />
    <div className="grid gap-4 lg:grid-cols-2">
      <label htmlFor="wins" className="block text-sm font-medium text-slate-300">
        Điều làm tốt trong tuần
        <textarea
          id="wins"
          maxLength={2000}
          disabled={disabled}
          {...register("wins")}
          className={textareaClass}
        />
      </label>
      <label
        htmlFor="challenges"
        className="block text-sm font-medium text-slate-300"
      >
        Khó khăn gặp phải
        <textarea
          id="challenges"
          maxLength={2000}
          disabled={disabled}
          {...register("challenges")}
          className={textareaClass}
        />
      </label>
    </div>
    <label htmlFor="note" className="block text-sm font-medium text-slate-300">
      Ghi chú thêm
      <textarea
        id="note"
        maxLength={2000}
        disabled={disabled}
        {...register("note")}
        className={textareaClass}
      />
    </label>
    {Object.keys(errors).length > 0 && (
      <p className="text-sm text-red-300" role="alert">
        Kiểm tra lại giới hạn cân nặng, vòng eo và các thang điểm 1–10.
      </p>
    )}
  </>
);