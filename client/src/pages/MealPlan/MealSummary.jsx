import React from "react";
import { useTranslation } from "react-i18next";
import { Target, TrendingUp, TrendingDown, Activity } from "lucide-react";

const MealSummary = ({
  totalMacros,
  totalCalories,
  targetMacros,
  targetLabel,
}) => {
  const { t } = useTranslation("mealplan");

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
    if (Math.abs(value) < 1) return t("summary.reached");
    if (value > 0) return t("summary.excess", { value: Math.round(value) });
    return t("summary.deficit", { value: Math.round(Math.abs(value)) });
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
      <h3 className="text-fluid-xl font-bold text-center mb-6 flex items-center justify-center gap-2">
        <Target className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
        {t("summary.total_daily")}
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 text-center">
        <div className="bg-gray-900/60 rounded-xl p-4 border border-gray-700">
          <div className="text-red-400 text-fluid-lg font-bold mb-1">
            {t("summary.protein")}
          </div>
          <div className="text-fluid-2xl font-black text-white">
            {totalMacros.protein}g
          </div>
          <div className="text-fluid-xs text-gray-400 mt-1">
            {totalCalories > 0
              ? Math.round((totalMacros.protein * 4 * 100) / totalCalories)
              : 0}
            {t("summary.percent_calories")}
          </div>
          <div className="mt-2 text-xs text-gray-400">
            {t("summary.target_g", { value: targetProtein })}
          </div>
          <div
            className={`text-xs mt-1 font-semibold ${getDiffColor(diffProtein)}`}
          >
            {t("summary.diff_protein", { diff: formatDiff(diffProtein) })}
          </div>
        </div>

        <div className="bg-gray-900/60 rounded-xl p-4 border border-gray-700">
          <div className="text-green-400 text-fluid-lg font-bold mb-1">
            {t("summary.carb")}
          </div>
          <div className="text-fluid-2xl font-black text-white">
            {totalMacros.carb}g
          </div>
          <div className="text-fluid-xs text-gray-400 mt-1">
            {totalCalories > 0
              ? Math.round((totalMacros.carb * 4 * 100) / totalCalories)
              : 0}
            {t("summary.percent_calories")}
          </div>
          <div className="mt-2 text-xs text-gray-400">
            {t("summary.target_g", { value: targetCarb })}
          </div>
          <div
            className={`text-xs mt-1 font-semibold ${getDiffColor(diffCarb)}`}
          >
            {t("summary.diff_carb", { diff: formatDiff(diffCarb) })}
          </div>
        </div>

        <div className="bg-gray-900/60 rounded-xl p-4 border border-gray-700">
          <div className="text-yellow-400 text-fluid-lg font-bold mb-1">
            {t("summary.fat")}
          </div>
          <div className="text-fluid-2xl font-black text-white">
            {totalMacros.fat}g
          </div>
          <div className="text-fluid-xs text-gray-400 mt-1">
            {totalCalories > 0
              ? Math.round((totalMacros.fat * 9 * 100) / totalCalories)
              : 0}
            {t("summary.percent_calories")}
          </div>
          <div className="mt-2 text-xs text-gray-400">
            {t("summary.target_g", { value: targetFat })}
          </div>
          <div
            className={`text-xs mt-1 font-semibold ${getDiffColor(diffFat)}`}
          >
            {t("summary.diff_fat", { diff: formatDiff(diffFat) })}
          </div>
        </div>
      </div>

      <div className="text-center mt-6 pt-4 border-t border-gray-700">
        <div className="text-fluid-3xl font-black text-primary">
          {totalCalories.toLocaleString()}{" "}
          <span className="text-fluid-base">kcal</span>
        </div>

        {targetCalories > 0 && (
          <div
            className={`mt-3 text-fluid-sm font-semibold ${statusColor}`}
          >
            <div className="flex items-center justify-center gap-2">
              {statusIcon}
              <span>
                {targetLabel ? `${targetLabel === "Tự nhập (Custom)" ? t("selector.custom_plan") : targetLabel} • ` : ""}
                {t("summary.target_kcal", { value: targetCalories.toLocaleString() })}
              </span>
            </div>

            <div className="mt-2 text-fluid-xs text-gray-300">
              {t("summary.actual_status")}{" "}
              <span className={statusColor}>
                {diffCalories === 0
                  ? t("summary.exact_match")
                  : `${diffCalories > 0 ? "+" : ""}${diffCalories} kcal`}
              </span>{" "}
              {t("summary.compared_to_target")}
            </div>

            <div className="mt-1 text-xs text-gray-400">
              {t("summary.percent_calories_goal", { value: Math.round(percent) })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MealSummary;
