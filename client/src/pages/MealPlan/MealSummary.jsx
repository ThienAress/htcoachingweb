import React from "react";
import { Target, TrendingUp, TrendingDown, Activity } from "lucide-react";

const MealSummary = ({
  totalMacros,
  totalCalories,
  targetMacros,
  targetLabel,
  onOpenMacroModal,
}) => {
  if (!totalMacros || totalMacros.protein === undefined) return null;

  const targetProtein = Number(targetMacros?.protein || 0);
  const targetCarb = Number(targetMacros?.carb || 0);
  const targetFat = Number(targetMacros?.fat || 0);
  const targetCalories = Number(targetMacros?.calories || 0);

  const diffCalories = totalCalories - targetCalories;
  const percent = targetCalories ? (totalCalories / targetCalories) * 100 : 0;

  const diffProtein = Number(totalMacros?.protein || 0) - targetProtein;
  const diffCarb = Number(totalMacros?.carb || 0) - targetCarb;
  const diffFat = Number(totalMacros?.fat || 0) - targetFat;

  const formatDiff = (value) => {
    if (Math.abs(value) < 1) return "Đạt chuẩn";
    if (value > 0) return `Dư ${Math.round(value)}g`;
    return `Thiếu ${Math.round(Math.abs(value))}g`;
  };

  const getDiffColor = (value) => {
    if (value === 0) return "text-green-400";
    if (value > 0) return "text-primary";
    return "text-red-400";
  };

  let statusColor = "text-green-400";
  let statusIcon = <Activity className="w-5 h-5" />;

  if (diffCalories > targetCalories * 0.1) {
    statusColor = "text-red-400";
    statusIcon = <TrendingUp className="w-5 h-5" />;
  } else if (diffCalories < -targetCalories * 0.1) {
    statusColor = "text-yellow-400";
    statusIcon = <TrendingDown className="w-5 h-5" />;
  }

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 p-4 sm:p-6 mt-8 shadow-xl">
      <h3 className="text-xl sm:text-2xl font-bold text-center mb-6 flex items-center justify-center gap-2">
        <Target className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
        Tổng dinh dưỡng cả ngày
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 text-center">
        <div className="bg-gray-900/60 rounded-xl p-4 border border-gray-700">
          <div className="text-red-400 text-lg sm:text-xl font-bold mb-1">
            Đạm
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white">
            {totalMacros.protein}g
          </div>
          <div className="text-xs sm:text-sm text-gray-400 mt-1">
            {totalCalories > 0
              ? Math.round((totalMacros.protein * 4 * 100) / totalCalories)
              : 0}
            % calo
          </div>
          <div className="mt-2 text-xs text-gray-400">
            Mục tiêu: {targetProtein}g
          </div>
          <div
            className={`text-xs mt-1 font-semibold ${getDiffColor(diffProtein)}`}
          >
            {formatDiff(diffProtein)} đạm
          </div>
        </div>

        <div className="bg-gray-900/60 rounded-xl p-4 border border-gray-700">
          <div className="text-green-400 text-lg sm:text-xl font-bold mb-1">
            Tinh bột
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white">
            {totalMacros.carb}g
          </div>
          <div className="text-xs sm:text-sm text-gray-400 mt-1">
            {totalCalories > 0
              ? Math.round((totalMacros.carb * 4 * 100) / totalCalories)
              : 0}
            % calo
          </div>
          <div className="mt-2 text-xs text-gray-400">
            Mục tiêu: {targetCarb}g
          </div>
          <div
            className={`text-xs mt-1 font-semibold ${getDiffColor(diffCarb)}`}
          >
            {formatDiff(diffCarb)} tinh bột
          </div>
        </div>

        <div className="bg-gray-900/60 rounded-xl p-4 border border-gray-700">
          <div className="text-yellow-400 text-lg sm:text-xl font-bold mb-1">
            Chất béo
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white">
            {totalMacros.fat}g
          </div>
          <div className="text-xs sm:text-sm text-gray-400 mt-1">
            {totalCalories > 0
              ? Math.round((totalMacros.fat * 9 * 100) / totalCalories)
              : 0}
            % calo
          </div>
          <div className="mt-2 text-xs text-gray-400">
            Mục tiêu: {targetFat}g
          </div>
          <div
            className={`text-xs mt-1 font-semibold ${getDiffColor(diffFat)}`}
          >
            {formatDiff(diffFat)} chất béo
          </div>
        </div>
      </div>

      <div className="text-center mt-6 pt-4 border-t border-gray-700">
        <div className="text-3xl sm:text-4xl font-black text-primary">
          {totalCalories.toLocaleString()}{" "}
          <span className="text-base sm:text-lg">kcal</span>
        </div>

        {targetCalories > 0 && (
          <div
            className={`mt-3 text-sm sm:text-base font-semibold ${statusColor}`}
          >
            <div className="flex items-center justify-center gap-2">
              {statusIcon}
              <span>
                {targetLabel ? `${targetLabel} • ` : ""}
                Mục tiêu {targetCalories.toLocaleString()} kcal
              </span>
            </div>

            <div className="mt-2 text-xs sm:text-sm text-gray-300">
              Thực tế đang{" "}
              <span className={statusColor}>
                {diffCalories === 0
                  ? "khớp hoàn toàn"
                  : `${diffCalories > 0 ? "+" : ""}${diffCalories} kcal`}
              </span>{" "}
              so với mục tiêu
            </div>

            <div className="mt-1 text-xs text-gray-400">
              Đạt {Math.round(percent)}% calories mục tiêu
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-center">
        <button
          onClick={onOpenMacroModal}
          className="px-5 py-2.5 rounded-full bg-primary hover:bg-primary-dark text-white font-semibold transition"
        >
          ✏️ Tinh chỉnh macro
        </button>
      </div>
    </div>
  );
};

export default MealSummary;
