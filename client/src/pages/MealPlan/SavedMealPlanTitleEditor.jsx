import { Check, X } from "lucide-react";
import { useState } from "react";
import { validateSavedMealPlanTitle } from "../../utils/savedMealPlan";

const errorText = {
  required: "Vui lòng nhập tên thực đơn.",
  too_long: "Tên thực đơn chỉ được tối đa 30 ký tự.",
  prohibited: "Tên thực đơn chứa từ ngữ không phù hợp. Vui lòng đặt tên khác.",
};

export default function SavedMealPlanTitleEditor({
  initialValue,
  isPending,
  onCancel,
  onSave,
}) {
  const [value, setValue] = useState(initialValue);
  const validation = validateSavedMealPlanTitle(value);
  const unchanged = validation.value === initialValue;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (validation.valid && !unchanged) onSave(validation.value);
      }}
      className="min-w-0"
    >
      <label htmlFor="saved-meal-plan-title" className="sr-only">
        Tên thực đơn
      </label>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          id="saved-meal-plan-title"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          maxLength={60}
          autoFocus
          disabled={isPending}
          aria-invalid={!validation.valid}
          aria-describedby="saved-meal-plan-title-help"
          className="min-h-11 min-w-0 flex-1 rounded-lg border border-gray-600 bg-gray-950 px-3 text-sm font-semibold text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={!validation.valid || unchanged || isPending}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-bold text-black hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Check size={16} aria-hidden="true" /> Lưu tên
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-300 disabled:opacity-40"
            aria-label="Hủy đổi tên"
          >
            <X size={17} aria-hidden="true" />
          </button>
        </div>
      </div>
      <p
        id="saved-meal-plan-title-help"
        className={`mt-1 text-xs ${validation.valid ? "text-gray-500" : "text-red-300"}`}
      >
        {validation.valid
          ? `${validation.value.length}/30 ký tự`
          : errorText[validation.reason]}
      </p>
    </form>
  );
}
