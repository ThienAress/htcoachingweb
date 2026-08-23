const inputClass =
  "mt-2 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-white outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/30 disabled:opacity-50";

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

export const WeeklyCheckinFields = ({ register, errors, disabled }) => (
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
        id="bodyFatPercent"
        label="Tỷ lệ mỡ cơ thể (%)"
        register={register}
        disabled={disabled}
        min="1"
        max="80"
        step="0.1"
      />
      <NumericField
        id="skeletalMusclePercent"
        label="Tỷ lệ cơ xương (%)"
        register={register}
        disabled={disabled}
        min="1"
        max="80"
        step="0.1"
      />
    </div>
    {Object.keys(errors).length > 0 && (
      <p className="text-sm text-red-300" role="alert">
        Kiểm tra lại giới hạn của các số đo cơ thể.
      </p>
    )}
  </>
);
