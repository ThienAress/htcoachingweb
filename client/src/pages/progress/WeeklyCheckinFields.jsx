import { ChevronDown } from "lucide-react";
import { useEffect, useId, useState } from "react";

const inputClass =
  "mt-2 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-white outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/30 disabled:opacity-50";

const CIRCUMFERENCES = [
  { key: "waistCm", label: "Vòng eo", unit: "cm", min: 30, max: 300 },
  { key: "hipCm", label: "Vòng hông", unit: "cm", min: 30, max: 300 },
  { key: "abdomenCm", label: "Vòng bụng", unit: "cm", min: 30, max: 300 },
];
const COMPOSITION = [
  { key: "bodyFatPercent", label: "Tỷ lệ mỡ cơ thể", unit: "%", min: 1, max: 80 },
  { key: "skeletalMusclePercent", label: "Tỷ lệ cơ xương", unit: "%", min: 1, max: 80 },
];
const ALL_FIELDS = [{ key: "weightKg", label: "Cân nặng", unit: "kg", min: 30, max: 350 }, ...CIRCUMFERENCES, ...COMPOSITION];
const hasValue = (value) => value !== "" && value !== null && value !== undefined;
const formatNumber = (value) => Number(value).toLocaleString("vi-VN", { maximumFractionDigits: 3 });

const NumericField = ({ field, register, disabled, error, prefix }) => {
  const id = `${prefix}-${field.key}`;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-300">
        {field.label} ({field.unit})
      </label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={field.min}
        max={field.max}
        step="0.1"
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        {...register(field.key)}
        className={inputClass}
      />
      {error && <p id={`${id}-error`} className="mt-1 text-sm text-red-300" role="alert">{error.message || `Nhập từ ${field.min} đến ${field.max} ${field.unit}.`}</p>}
    </div>
  );
};

const MeasurementGroup = ({ title, fields, register, errors, disabled, values, prefix, children }) => {
  const [expanded, setExpanded] = useState(false);
  const open = expanded || fields.some(({ key }) => errors[key]);
  const entered = fields.filter(({ key }) => hasValue(values[key]));
  const id = `${prefix}-${fields[0].key}-group`;
  return (
    <section className="border-t border-slate-800 pt-3">
      <button type="button" aria-expanded={Boolean(open)} aria-controls={id}
        onClick={() => setExpanded(!open)}
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg py-2 text-left text-sm font-semibold text-slate-200 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400">
        <span>{title}<span className="ml-3 text-xs font-normal text-slate-400">Đã nhập {entered.length}/{fields.length}</span></span>
        <ChevronDown size={18} aria-hidden="true" className={open ? "rotate-180" : ""} />
      </button>
      {!open && <p className="pb-2 text-xs leading-5 text-slate-400">
        {entered.length ? entered.map(({ key, label, unit }) => `${label}: ${formatNumber(values[key])} ${unit}`).join(" · ") : "Chưa nhập số đo. Các trường này không bắt buộc."}
      </p>}
      <div id={id} hidden={!open} className="space-y-3 py-3">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {fields.map((field) => <NumericField key={field.key} field={field} register={register} error={errors[field.key]} disabled={disabled} prefix={prefix} />)}
        </div>
        {children}
      </div>
    </section>
  );
};

export const WeeklyCheckinFields = ({ register, errors = {}, disabled, values = {}, setFocus }) => {
  const prefix = useId();
  const firstError = ALL_FIELDS.find(({ key }) => errors[key])?.key;
  useEffect(() => {
    if (firstError) setFocus?.(firstError);
  }, [firstError, errors, setFocus]);
  const validCircumference = (value) => hasValue(value) && Number.isFinite(Number(value)) && Number(value) >= 30 && Number(value) <= 300;
  const ratio = validCircumference(values.waistCm) && validCircumference(values.hipCm)
    ? Number(values.waistCm) / Number(values.hipCm) : null;
  const groupProps = { register, errors, disabled, values, prefix };
  return (
    <div className="space-y-4">
      <div className="sm:max-w-xs"><NumericField field={ALL_FIELDS[0]} register={register} error={errors.weightKg} disabled={disabled} prefix={prefix} /></div>
      <MeasurementGroup title="Số đo vòng" fields={CIRCUMFERENCES} {...groupProps}>
        <p className="text-xs leading-5 text-slate-400">Vòng bụng đo ngang rốn, khác vị trí vòng eo. Giữ vị trí và cách đo eo/hông theo hướng dẫn của HLV giữa các lần ghi nhận.</p>
        <p className="text-sm text-slate-300">Tỷ lệ eo/hông: <output aria-live="polite" className="font-semibold tabular-nums text-white">{ratio === null ? "—" : formatNumber(ratio)}</output><span className="ml-2 text-xs text-slate-400">Tự tính từ số eo và hông trong báo cáo này; không có đơn vị.</span></p>
      </MeasurementGroup>
      <MeasurementGroup title="Thành phần cơ thể" fields={COMPOSITION} {...groupProps} />
    </div>
  );
};
