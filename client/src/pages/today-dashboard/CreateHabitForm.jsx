import { Plus, Save, X } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import {
  HABIT_DAY_LABELS,
  getHabitWeekRange,
  habitFormDefaults,
  habitFormSchema,
  habitFormToPayload,
  habitToFormValues,
} from "./habitForm";

const formatDateKey = (dateKey) => {
  const [year, month, day] = String(dateKey || "").split("-");
  return year && month && day ? `${day}/${month}/${year}` : "";
};

export const CreateHabitForm = ({
  dateKey,
  disabled,
  onCreate,
  trainerMode = false,
  initialHabit = null,
  onUpdate,
  onCancel,
}) => {
  const isEditing = Boolean(initialHabit);
  const idSuffix = initialHabit?._id || "new";
  const {
    register,
    control,
    setValue,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(habitFormSchema),
    defaultValues: isEditing
      ? habitToFormValues(initialHabit)
      : habitFormDefaults,
  });
  const daysOfWeek = useWatch({ control, name: "daysOfWeek" }) || [];
  const description = useWatch({ control, name: "description" }) || "";
  const trainerWeek = trainerMode ? getHabitWeekRange(dateKey) : null;

  useEffect(() => {
    reset(isEditing ? habitToFormValues(initialHabit) : habitFormDefaults);
  }, [initialHabit, isEditing, reset]);

  const toggleDay = (day) => {
    setValue(
      "daysOfWeek",
      daysOfWeek.includes(day)
        ? daysOfWeek.filter((value) => value !== day)
        : [...daysOfWeek, day].sort(),
      { shouldValidate: true },
    );
  };

  const submit = (values) => {
    const payload = habitFormToPayload(values, dateKey, {
      trainer: trainerMode,
      habit: initialHabit,
    });
    if (isEditing) {
      onUpdate?.(payload);
      return;
    }
    onCreate(payload);
    reset(habitFormDefaults);
  };

  const form = (
    <form onSubmit={handleSubmit(submit)} className="mt-4">
      <label
        htmlFor={`habit-title-${idSuffix}`}
        className="text-sm text-slate-300"
      >
        Tên thói quen
      </label>
      <input
        id={`habit-title-${idSuffix}`}
        {...register("title")}
        maxLength={100}
        disabled={disabled}
        placeholder="Ví dụ: Đi bộ 20 phút"
        className="mt-2 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/30 disabled:opacity-50"
      />
      {trainerMode && (
        <label
          htmlFor={`habit-description-${idSuffix}`}
          className="mt-4 block text-sm text-slate-300"
        >
          Mô tả
          <textarea
            id={`habit-description-${idSuffix}`}
            {...register("description")}
            maxLength={500}
            rows={3}
            disabled={disabled}
            placeholder="Ví dụ: Đi bộ sau bữa tối với nhịp độ vừa phải"
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm leading-6 text-white outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/30 disabled:opacity-50"
          />
          <span className="mt-1 block text-right text-xs tabular-nums text-slate-500">
            {description.length}/500
          </span>
        </label>
      )}
      <label
        htmlFor={`habit-category-${idSuffix}`}
        className="mt-4 block text-sm text-slate-300"
      >
        Nhóm
      </label>
      <select
        id={`habit-category-${idSuffix}`}
        {...register("category")}
        disabled={disabled}
        className="mt-2 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400/30 disabled:opacity-50"
      >
        <option value="recovery">Phục hồi</option>
        <option value="nutrition">Dinh dưỡng</option>
        <option value="movement">Vận động</option>
        <option value="mindset">Tinh thần</option>
        <option value="other">Khác</option>
      </select>
      {trainerMode && (
        <div className="mt-4 border-l-2 border-orange-400 bg-orange-500/5 px-4 py-3">
          <p className="text-sm font-semibold text-orange-200">
            Tuần áp dụng
          </p>
          <p className="mt-1 text-sm tabular-nums text-slate-300">
            Thứ Hai {formatDateKey(trainerWeek.startDateKey)} – Chủ Nhật{" "}
            {formatDateKey(trainerWeek.endDateKey)}
          </p>
        </div>
      )}
      <fieldset className="mt-4">
          <legend className="text-sm text-slate-300">
            {trainerMode ? "Chọn ngày học viên thực hiện" : "Ngày áp dụng"}
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {HABIT_DAY_LABELS.map((label, day) => {
              const selected = daysOfWeek.includes(day);
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => toggleDay(day)}
                  disabled={disabled}
                  aria-pressed={selected}
                  className={`min-h-11 min-w-11 rounded-lg border px-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 disabled:opacity-40 ${
                    selected
                      ? "border-orange-400 bg-orange-500/10 text-orange-200"
                      : "border-slate-700 text-slate-400 hover:bg-slate-800"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {trainerMode && (
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Ngày không được chọn vẫn hiện trong tuần nhưng học viên không thể
              đánh dấu hoàn thành.
            </p>
          )}
        </fieldset>
      {!trainerMode && (
        <label className="mt-4 flex min-h-11 items-center gap-3 text-sm text-slate-300">
          <input
            type="checkbox"
            {...register("shared")}
            disabled={disabled}
            className="h-5 w-5 accent-orange-500"
          />
          Chia sẻ thói quen này với HLV
        </label>
      )}
      {(errors.title || errors.description || errors.daysOfWeek) && (
        <p className="mt-2 text-sm text-red-300">
          {trainerMode
            ? "Nhập tên, giữ mô tả trong 500 ký tự và chọn ít nhất một ngày."
            : "Nhập tên thói quen và chọn ít nhất một ngày."}
        </p>
      )}
      <button
        type="submit"
        disabled={disabled}
        className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-orange-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:opacity-40"
      >
        {isEditing ? (
          <Save size={16} aria-hidden="true" />
        ) : (
          <Plus size={16} aria-hidden="true" />
        )}
        {isEditing ? "Cập nhật thói quen" : "Tạo thói quen"}
      </button>
    </form>
  );

  if (isEditing) {
    return (
      <div className="mt-5 border-t border-slate-700 pt-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-orange-200">
            Cập nhật thói quen
          </h3>
          <button
            type="button"
            onClick={onCancel}
            disabled={disabled}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm text-slate-300 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 disabled:opacity-40"
          >
            <X size={16} aria-hidden="true" /> Hủy
          </button>
        </div>
        {form}
      </div>
    );
  }

  return (
    <details className="mt-5 rounded-xl border border-slate-700 bg-slate-900/50 p-4">
      <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold text-orange-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400">
        {trainerMode
          ? "Giao thói quen cho học viên"
          : "Tạo thói quen cá nhân"}
      </summary>
      {form}
    </details>
  );
};
