import { Plus } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import {
  habitFormDefaults,
  habitFormSchema,
  habitFormToPayload,
} from "./habitForm";

const DAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

export const CreateHabitForm = ({
  dateKey,
  disabled,
  onCreate,
  trainerMode = false,
}) => {
  const {
    register,
    control,
    setValue,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(habitFormSchema),
    defaultValues: habitFormDefaults,
  });
  const daysOfWeek = useWatch({ control, name: "daysOfWeek" });

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
    onCreate(habitFormToPayload(values, dateKey, { trainer: trainerMode }));
    reset(habitFormDefaults);
  };

  return (
    <details className="mt-5 rounded-xl border border-slate-700 bg-slate-900/50 p-4">
      <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold text-orange-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400">
        {trainerMode ? "Giao habit cho học viên" : "Tạo habit cá nhân"}
      </summary>
      <form onSubmit={handleSubmit(submit)} className="mt-4">
        <label htmlFor="habit-title" className="text-sm text-slate-300">
          Tên habit
        </label>
        <input
          id="habit-title"
          {...register("title")}
          maxLength={100}
          disabled={disabled}
          placeholder="Ví dụ: Đi bộ 20 phút"
          className="mt-2 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/30 disabled:opacity-50"
        />
        <label htmlFor="habit-category" className="mt-4 block text-sm text-slate-300">
          Nhóm
        </label>
        <select
          id="habit-category"
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
        <fieldset className="mt-4">
          <legend className="text-sm text-slate-300">Ngày áp dụng</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {DAYS.map((label, day) => {
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
        </fieldset>
        {!trainerMode && (
          <label className="mt-4 flex min-h-11 items-center gap-3 text-sm text-slate-300">
            <input
              type="checkbox"
              {...register("shared")}
              disabled={disabled}
              className="h-5 w-5 accent-orange-500"
            />
            Chia sẻ habit này với HLV
          </label>
        )}
        {(errors.title || errors.daysOfWeek) && (
          <p className="mt-2 text-sm text-red-300">
            Nhập tên habit và chọn ít nhất một ngày.
          </p>
        )}
        <button
          type="submit"
          disabled={disabled}
          className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-orange-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:opacity-40"
        >
          <Plus size={16} aria-hidden="true" /> Tạo habit
        </button>
      </form>
    </details>
  );
};
