import { Utensils } from "lucide-react";

export default function MealSuggestionCard({ data }) {
  if (!data) return null;
  if (data.status === "missing_data") {
    return (
      <div className="w-full rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100" role="status">
        Chưa đủ dữ liệu thực phẩm đã kiểm duyệt để tạo thực đơn an toàn.
      </div>
    );
  }
  if (!data.meals?.length) return null;
  const { targetCalories, totals, macros, meals } = data;
  const totalCalories = totals?.calories ?? targetCalories;

  return (
    <div className="bg-gradient-to-br from-orange-500/10 to-yellow-500/10 border border-orange-500/20 rounded-xl p-4 space-y-3 w-full">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Utensils size={16} className="text-orange-400" />
          <span className="text-xs font-bold text-orange-400 uppercase tracking-wider">Gợi ý thực đơn</span>
        </div>
        <span className="text-[10px] text-gray-400 bg-white/5 px-2 py-0.5 rounded-full">
          {totalCalories} kcal thực tế · mục tiêu {targetCalories} kcal
        </span>
      </div>

      {/* Macro summary */}
      {macros && (
        <div className="flex gap-3 text-[11px]">
          <span className="text-blue-400">P: {macros.protein}g</span>
          <span className="text-yellow-400">C: {macros.carb}g</span>
          <span className="text-pink-400">F: {macros.fat}g</span>
        </div>
      )}

      {/* Meals */}
      <div className="space-y-2">
        {meals.map((meal, i) => (
          <div key={i} className="bg-black/20 rounded-lg p-2.5">
            <p className="text-xs font-semibold text-orange-300 mb-1.5">{meal.label}</p>
            <div className="space-y-1">
              {meal.foods.map((food, j) => (
                <div key={j} className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="text-gray-300 truncate">
                    {food.amountGrams}g {food.name}
                    {food.macros && (
                      <span className="ml-1 text-gray-500">
                        ({food.macros.protein}g P, {food.macros.carb}g C, {food.macros.fat}g F)
                      </span>
                    )}
                  </span>
                  <span className="text-gray-500 shrink-0">{food.calories} kcal</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
