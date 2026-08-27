import {
  WELLNESS_SEMANTIC_OPTIONS,
  wellnessSemanticLabel,
  wellnessSemanticValue,
} from "./wellness";
import { useId } from "react";

const fieldClass =
  "mt-1.5 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-400/30 disabled:cursor-not-allowed disabled:opacity-60";

const NumberField = ({ label, name, register, error, ...inputProps }) => (
  <label className="text-sm font-medium text-slate-300">
    {label}
    <input
      type="number"
      {...register(name)}
      {...inputProps}
      aria-invalid={Boolean(error)}
      className={fieldClass}
    />
    {error && <span role="alert" className="mt-1 block text-xs text-red-300">{error}</span>}
  </label>
);

const RatingField = ({
  label,
  name,
  register,
  error,
  helperId,
  disabled,
}) => {
  const options = WELLNESS_SEMANTIC_OPTIONS[name] || [];
  const representativeValues = new Set(options.map(({ value }) => value));
  const minimum = name === "pain" ? 0 : 1;
  const legacyOptions = Array.from(
    { length: 11 - minimum },
    (_, index) => index + minimum,
  ).filter((value) => !representativeValues.has(value));

  return (
    <label className="text-sm font-medium text-slate-300">
      {label}
      <select
        {...register(name)}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={helperId}
        className={fieldClass}
      >
        <option value="">Chưa chọn</option>
        {legacyOptions.map((value) => (
          <option key={`legacy-${value}`} value={value} hidden>
            {wellnessSemanticLabel(name, value)}
          </option>
        ))}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <span role="alert" className="mt-1 block text-xs text-red-300">
          {error}
        </span>
      )}
    </label>
  );
};

export const WellnessFields = ({ register, errors, disabled, painValue }) => {
  const semanticPainValue = wellnessSemanticValue("pain", painValue);
  const ratingHelperId = useId();

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <NumberField
          label="Giấc ngủ (giờ)"
          name="sleepHours"
          register={register}
          error={errors.sleepHours?.message}
          min="0"
          max="24"
          step="0.5"
          disabled={disabled}
        />
        <NumberField
          label="Nước uống (ml)"
          name="waterMl"
          register={register}
          error={errors.waterMl?.message}
          min="0"
          max="20000"
          step="100"
          disabled={disabled}
        />
        <NumberField
          label="Số bước"
          name="steps"
          register={register}
          error={errors.steps?.message}
          min="0"
          max="200000"
          step="100"
          disabled={disabled}
        />
      </div>
      <p id={ratingHelperId} className="text-xs leading-5 text-slate-500">
        Chọn mô tả gần nhất với cảm nhận của bạn.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["Năng lượng", "energy"],
          ["Cảm giác đói", "hunger"],
          ["Căng thẳng", "stress"],
          ["Đau mỏi", "soreness"],
        ].map(([label, name]) => (
          <RatingField
            key={name}
            label={label}
            name={name}
            register={register}
            error={errors[name]?.message}
            helperId={ratingHelperId}
            disabled={disabled}
          />
        ))}
        <RatingField
          label="Mức đau"
          name="pain"
          register={register}
          error={errors.pain?.message}
          helperId={ratingHelperId}
          disabled={disabled}
        />
      </div>
      {semanticPainValue > 0 && (
        <label className="block text-sm font-medium text-slate-300">
          Vị trí đau
          <input
            {...register("painArea")}
            disabled={disabled}
            aria-invalid={Boolean(errors.painArea)}
            maxLength={120}
            className={fieldClass}
            placeholder="Ví dụ: vai phải"
          />
          {errors.painArea && (
            <span role="alert" className="mt-1 block text-xs text-red-300">
              {errors.painArea.message}
            </span>
          )}
        </label>
      )}
      {semanticPainValue >= 9 && (
        <p
          className="rounded-lg border border-amber-700/60 bg-amber-950/30 px-4 py-3 text-sm leading-6 text-amber-100"
          role="alert"
        >
          Mức đau cao. Hãy dừng bài gây đau và liên hệ HLV hoặc chuyên gia y tế
          phù hợp. Thông báo này không phải chẩn đoán.
        </p>
      )}
      <label className="block text-sm font-medium text-slate-300">
        Chia sẻ với HLV
        <textarea
          {...register("sharedNote")}
          disabled={disabled}
          aria-invalid={Boolean(errors.sharedNote)}
          rows={3}
          maxLength={2000}
          className={fieldClass}
          placeholder="Thông tin bạn muốn HLV biết"
        />
        {errors.sharedNote && (
          <span role="alert" className="mt-1 block text-xs text-red-300">
            {errors.sharedNote.message}
          </span>
        )}
      </label>
    </>
  );
};
