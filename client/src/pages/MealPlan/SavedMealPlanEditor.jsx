import { RefreshCw, Save, X } from "lucide-react";
import { savedMealPlanToTableMeals } from "../../utils/savedMealPlan";
import MealTable from "./MealTable";

export default function SavedMealPlanEditor({
  currentMeals,
  isPending,
  onClose,
  onGenerateAnother,
  onSave,
  plan,
  useGeneratedMeals,
}) {
  const displayMeals = useGeneratedMeals
    ? currentMeals
    : savedMealPlanToTableMeals(plan);

  return (
    <section
      className="mt-4 border-y border-gray-700 py-5"
      aria-labelledby="saved-meal-plan-editor-title"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 id="saved-meal-plan-editor-title" className="font-bold text-white">
            Chỉnh sửa {plan.title}
          </h3>
          <p className="mt-1 text-sm leading-6 text-gray-400">
            {useGeneratedMeals
              ? "Kiểm tra phương án mới trước khi lưu thay đổi."
              : "Đây là nội dung thực đơn đang được lưu."}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={isPending}
          className="inline-flex min-h-11 items-center gap-2 self-start rounded-lg px-3 text-sm font-semibold text-gray-300 hover:bg-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-300 disabled:opacity-40"
        >
          <X size={16} aria-hidden="true" /> Đóng
        </button>
      </div>
      <MealTable meals={displayMeals} />
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onGenerateAnother}
          disabled={isPending}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-primary/60 px-4 text-sm font-semibold text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40"
        >
          <RefreshCw size={16} aria-hidden="true" /> Đổi thực đơn khác
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={!useGeneratedMeals || currentMeals.length === 0 || isPending}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-black hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Save size={16} aria-hidden="true" /> Lưu thực đơn
        </button>
      </div>
      {!useGeneratedMeals && (
        <p className="mt-2 text-right text-xs text-gray-500">
          Hãy chọn Đổi thực đơn khác để bật nút Lưu thực đơn.
        </p>
      )}
    </section>
  );
}
