import { Controller } from "react-hook-form";
import SelectField from "../../components/SelectField";

export const fieldClass =
  "mt-1.5 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-400/30 disabled:cursor-not-allowed disabled:opacity-60";

const ErrorText = ({ message }) =>
  message ? (
    <span role="alert" className="mt-1 block text-xs text-red-300">
      {message}
    </span>
  ) : null;

export const InputField = ({ label, name, register, error, hint, inputMode, type = "text", disabled, ...rest }) => (
  <label className="block text-sm font-medium text-slate-300">
    {label}
    <input
      type={type}
      inputMode={inputMode}
      step={type === "number" ? "any" : undefined}
      {...register(name)}
      {...rest}
      disabled={disabled}
      aria-invalid={Boolean(error)}
      className={fieldClass}
    />
    {hint && !error && <span className="mt-1 block text-xs font-normal text-slate-500">{hint}</span>}
    <ErrorText message={error} />
  </label>
);

export const ChoiceField = ({ label, name, control, options, error, hint, placeholder = "Chọn", disabled }) => (
  <div className="text-sm font-medium text-slate-300">
    <span id={`${name}-label`}>{label}</span>
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <SelectField
          tone="dark"
          aria-label={label}
          value={field.value ?? ""}
          onChange={(event) => field.onChange(event.target.value)}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          className={fieldClass}
          placeholder={placeholder}
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectField>
      )}
    />
    {hint && !error && <span className="mt-1 block text-xs font-normal text-slate-500">{hint}</span>}
    <ErrorText message={error} />
  </div>
);

export const CheckboxGroup = ({ legend, name, control, options, disabled }) => (
  <fieldset className="text-sm text-slate-300">
    <legend className="font-medium">{legend}</legend>
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {options.map((option) => {
            const checked = field.value.includes(option.value);
            return (
              <label
                key={option.value}
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 transition hover:border-slate-500"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() =>
                    field.onChange(
                      checked ? field.value.filter((item) => item !== option.value) : [...field.value, option.value],
                    )
                  }
                  className="h-4 w-4 accent-orange-500"
                />
                <span>{option.label}</span>
              </label>
            );
          })}
        </div>
      )}
    />
  </fieldset>
);

export const CardSection = ({ title, description, children }) => (
  <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
    <h3 className="text-base font-bold text-white">{title}</h3>
    {description && <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p>}
    <div className="mt-4 space-y-4">{children}</div>
  </section>
);

export const StepActions = ({ onBack, backLabel = "Quay lại", submitLabel, pending }) => (
  <div className="flex flex-wrap items-center justify-between gap-3">
    {onBack ? (
      <button
        type="button"
        onClick={onBack}
        disabled={pending}
        className="min-h-11 rounded-xl border border-slate-700 px-5 py-2 text-sm font-semibold text-slate-300 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 disabled:opacity-60"
      >
        {backLabel}
      </button>
    ) : (
      <span />
    )}
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-orange-500 px-6 py-2 text-sm font-bold text-slate-950 transition-colors hover:bg-orange-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Đang lưu..." : submitLabel}
    </button>
  </div>
);
