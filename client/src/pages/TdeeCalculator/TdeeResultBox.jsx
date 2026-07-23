import React from "react";
import { useTranslation } from "react-i18next";
import { Zap, Bed, Target } from "lucide-react";

const TdeeResultBox = ({ tdee, bmr, adjustedCalories, goal }) => {
  const { t } = useTranslation("tdee");
  const goalText =
    goal === "gain_muscle" ? t("result.goal_gain_muscle")
    : goal === "gain_weight" ? t("result.goal_gain_weight")
    : goal === "lose_fat" ? t("result.goal_lose_fat")
    : goal === "lose_weight" ? t("result.goal_lose_weight")
    : t("result.goal_maintain");

  return (
    <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      <div className="group bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 text-center border border-gray-700 hover:border-primary/50 transition-all duration-300 hover:shadow-xl hover:shadow-primary/10">
        <div className="w-16 h-16 mx-auto bg-primary/20 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition">
          <Zap className="w-8 h-8 text-primary" />
        </div>
        <h4 className="font-bold text-gray-300 text-lg uppercase tracking-wide mb-2">
          {t("result.your_tdee")}
        </h4>
        <div className="text-fluid-5xl font-black text-primary">
          {tdee} <span className="text-base text-gray-400">{t("unit_kcal")}</span>
        </div>
      </div>

      <div className="group bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 text-center border border-gray-700 hover:border-primary/50 transition-all duration-300 hover:shadow-xl hover:shadow-primary/10">
        <div className="w-16 h-16 mx-auto bg-primary/20 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition">
          <Bed className="w-8 h-8 text-primary" />
        </div>
        <h4 className="font-bold text-gray-300 text-lg uppercase tracking-wide mb-2">
          {t("result.your_bmr")}
        </h4>
        <div className="text-fluid-5xl font-black text-primary">
          {bmr} <span className="text-base text-gray-400">{t("unit_kcal")}</span>
        </div>
      </div>

      <div className="group bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 text-center border border-gray-700 hover:border-primary/50 transition-all duration-300 hover:shadow-xl hover:shadow-primary/10">
        <div className="w-16 h-16 mx-auto bg-primary/20 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition">
          <Target className="w-8 h-8 text-primary" />
        </div>
        <h4 className="font-bold text-gray-300 text-lg uppercase tracking-wide mb-2">
          {t("result.calories_needed", { goal: goalText })}
        </h4>
        <div className="text-fluid-5xl font-black text-primary">
          {adjustedCalories}{" "}
          <span className="text-base text-gray-400">{t("unit_kcal")}</span>
        </div>
      </div>
    </div>
  );
};

export default React.memo(TdeeResultBox);
