import { Plus, Save, X } from "lucide-react";
import { useState } from "react";
import { createManualMealEntry } from "./dailyNutrition";

const newEntryId = () => window.crypto.randomUUID();

export const QuickMealLogger = ({ entryCount, disabled, onAdd }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [mealName, setMealName] = useState("");
  const [foodDescription, setFoodDescription] = useState("");
  const [error, setError] = useState("");
  const limitReached = entryCount >= 10;

  const reset = () => {
    setMealName("");
    setFoodDescription("");
    setError("");
  };

  const submit = (event) => {
    event.preventDefault();
    setError("");
    if (limitReached) {
      setError("Mỗi ngày có tối đa 10 mục bữa ăn.");
      return;
    }
    if (!mealName.trim()) {
      setError("Vui lòng nhập tên bữa ăn.");
      return;
    }
    if (!foodDescription.trim()) {
      setError("Vui lòng nhập các món bạn đã ăn.");
      return;
    }
    try {
      onAdd(
        createManualMealEntry({
          entryId: newEntryId(),
          mealName,
          foodDescription,
        }),
      );
      reset();
      setIsOpen(false);
    } catch (submitError) {
      setError(submitError.message);
    }
  };

  return (
    <section className="mt-5 border-y border-slate-800 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-semibold text-white">Ghi bữa ăn phát sinh</h3>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            Ghi lại bữa ăn ngoài thực đơn đã áp dụng trong ngày.
          </p>
        </div>
        <span className="text-xs font-semibold text-slate-400">
          {entryCount}/10 mục
        </span>
      </div>

      {!isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          disabled={disabled || limitReached}
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-orange-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus size={16} aria-hidden="true" /> Thêm bữa ăn
        </button>
      ) : (
        <form onSubmit={submit} className="mt-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold text-slate-300">
              Bữa ăn
              <input
                value={mealName}
                onChange={(event) => setMealName(event.target.value)}
                maxLength={80}
                disabled={disabled || limitReached}
                placeholder="Ví dụ: Bữa phụ"
                className="mt-2 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-orange-400 focus:ring-2 focus:ring-orange-400/30 disabled:opacity-50"
              />
            </label>
            <label className="text-sm font-semibold text-slate-300">
              Đồ ăn
              <input
                value={foodDescription}
                onChange={(event) => setFoodDescription(event.target.value)}
                maxLength={240}
                disabled={disabled || limitReached}
                placeholder="Ví dụ: sữa chua và một quả chuối"
                className="mt-2 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-orange-400 focus:ring-2 focus:ring-orange-400/30 disabled:opacity-50"
              />
            </label>
          </div>
          {error && (
            <p className="mt-3 text-sm text-red-300" role="alert">
              {error}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={disabled || limitReached}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-orange-500 px-4 text-sm font-bold text-slate-950 hover:bg-orange-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:opacity-40"
            >
              <Save size={16} aria-hidden="true" /> Lưu
            </button>
            <button
              type="button"
              onClick={() => {
                reset();
                setIsOpen(false);
              }}
              disabled={disabled}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-700 px-4 text-sm font-semibold text-slate-300 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 disabled:opacity-40"
            >
              <X size={16} aria-hidden="true" /> Hủy
            </button>
          </div>
        </form>
      )}
      {!isOpen && error && (
        <p className="mt-3 text-sm text-red-300" role="alert">
          {error}
        </p>
      )}
    </section>
  );
};
