import React from "react";
import { useTranslation } from "react-i18next";

const MealSelector = ({
  selectedPlan,
  setSelectedPlan,
  macroSet,
  selectedMacroPlan,
  setSelectedMacroPlan,
}) => {
  const { t } = useTranslation("mealplan");
  const isLoadingMacro = !macroSet;

  const currentPlanData = selectedMacroPlan
    ? macroSet?.[selectedMacroPlan]
    : null;

  const cardClass =
    "w-full h-full bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 shadow-xl overflow-hidden hover:border-primary/50 transition";

  const headerClass =
    "bg-gradient-to-r from-gray-700 to-gray-800 px-5 sm:px-6 border-b border-gray-600 min-h-[88px] sm:min-h-[96px] flex items-center";

  const titleClass =
    "font-bold text-primary leading-none whitespace-nowrap text-[clamp(1.4rem,3vw,2.5rem)]";

  const selectClass =
    "w-full h-12 px-4 bg-gray-700 border border-gray-600 rounded-xl text-white focus:ring-2 focus:ring-primary outline-none";

  const infoBoxClass =
    "mt-5 p-4 bg-gray-900/60 rounded-xl border border-gray-700 space-y-2";

  return (
    <phantom-ui loading={isLoadingMacro || undefined}>
    <div className="w-full max-w-5xl mx-auto my-8 px-4 sm:px-0">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 xl:gap-8 items-stretch">
        {/* Card chế độ dinh dưỡng */}
        <div className={cardClass}>
          <div className={headerClass}>
            <h3 className={titleClass}>{t("selector.nutrition_title")}</h3>
          </div>

          <div className="p-5 sm:p-6 h-full flex flex-col">
            <select
              value={selectedMacroPlan || ""}
              onChange={(e) => setSelectedMacroPlan(e.target.value)}
              className={selectClass}
            >
              <option value="" disabled>
                {t("selector.select_mode")}
              </option>
              {macroSet && Object.keys(macroSet).map((plan) => (
                <option key={plan} value={plan}>
                  {plan === "Tự nhập (Custom)" ? t("selector.custom_plan") : plan}
                </option>
              ))}
            </select>

            {selectedMacroPlan && currentPlanData && (
              <div className={infoBoxClass}>
                <p className="flex justify-between items-center gap-4">
                  <span className="text-red-400 font-semibold">{t("selector.protein")}</span>
                  <span className="shrink-0">{currentPlanData.protein}g</span>
                </p>

                <p className="flex justify-between items-center gap-4">
                  <span className="text-green-400 font-semibold">{t("selector.carb")}</span>
                  <span className="shrink-0">{currentPlanData.carb}g</span>
                </p>

                <p className="flex justify-between items-center gap-4">
                  <span className="text-yellow-400 font-semibold">
                    {t("selector.fat")}
                  </span>
                  <span className="shrink-0">{currentPlanData.fat}g</span>
                </p>

                <p className="flex justify-between items-center gap-4 border-t border-gray-700 pt-2 mt-2">
                  <span className="text-primary font-bold">Calories</span>
                  <span className="text-primary font-bold shrink-0">
                    {Math.round(currentPlanData.calories).toLocaleString()} kcal
                  </span>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Card số bữa */}
        <div className={cardClass}>
          <div className={headerClass}>
            <h3 className={titleClass}>{t("selector.meals_title")}</h3>
          </div>

          <div className="p-5 sm:p-6 h-full flex flex-col">
            <select
              value={selectedPlan}
              onChange={(e) => setSelectedPlan(Number(e.target.value))}
              className={selectClass}
            >
              {[3, 4, 5, 6].map((num) => (
                <option key={num} value={num}>
                  {t("selector.meals_unit", { num })}
                </option>
              ))}
            </select>

            {selectedMacroPlan && currentPlanData && (
              <div className={infoBoxClass}>
                <p className="flex justify-between items-center gap-4">
                  <span className="text-red-400 font-semibold">{t("selector.protein_per_meal")}</span>
                  <span className="shrink-0">
                    {Math.round(currentPlanData.protein / selectedPlan)}g
                  </span>
                </p>

                <p className="flex justify-between items-center gap-4">
                  <span className="text-green-400 font-semibold">
                    {t("selector.carb_per_meal")}
                  </span>
                  <span className="shrink-0">
                    {Math.round(currentPlanData.carb / selectedPlan)}g
                  </span>
                </p>

                <p className="flex justify-between items-center gap-4">
                  <span className="text-yellow-400 font-semibold">
                    {t("selector.fat_per_meal")}
                  </span>
                  <span className="shrink-0">
                    {Math.round(currentPlanData.fat / selectedPlan)}g
                  </span>
                </p>

                <p className="flex justify-between items-center gap-4 border-t border-gray-700 pt-2 mt-2">
                  <span className="text-primary font-bold">{t("selector.calories_per_meal")}</span>
                  <span className="text-primary font-bold shrink-0">
                    {Math.round(currentPlanData.calories / selectedPlan)} kcal
                  </span>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </phantom-ui>
  );
};

export default MealSelector;
