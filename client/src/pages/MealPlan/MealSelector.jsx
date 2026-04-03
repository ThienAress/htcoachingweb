import React from "react";
import { TrendingUp, Coffee } from "lucide-react";

const MealSelector = ({
  selectedPlan,
  setSelectedPlan,
  macroSet,
  selectedMacroPlan,
  setSelectedMacroPlan,
}) => {
  if (!macroSet)
    return (
      <div className="text-center py-8 text-gray-400 animate-pulse">
        Đang tải dữ liệu...
      </div>
    );

  const currentPlanData = selectedMacroPlan
    ? macroSet[selectedMacroPlan]
    : null;

  return (
    <div className="flex flex-col lg:flex-row justify-center items-stretch gap-6 my-8">
      {/* Card chế độ dinh dưỡng */}
      <div className="w-full lg:w-80 bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 shadow-xl overflow-hidden hover:border-orange-500/50 transition">
        <div className="bg-gradient-to-r from-gray-700 to-gray-800 px-5 py-3 border-b border-gray-600">
          <h3 className="font-bold text-orange-400 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" /> Chế độ dinh dưỡng
          </h3>
        </div>
        <div className="p-5">
          <select
            value={selectedMacroPlan || ""}
            onChange={(e) => setSelectedMacroPlan(e.target.value)}
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-xl text-white focus:ring-2 focus:ring-orange-500"
          >
            <option value="" disabled>
              Chọn chế độ
            </option>
            {Object.keys(macroSet).map((plan) => (
              <option key={plan} value={plan}>
                {plan}
              </option>
            ))}
          </select>
          {selectedMacroPlan && currentPlanData && (
            <div className="mt-5 p-4 bg-gray-900/60 rounded-xl border border-gray-700 space-y-2">
              <p className="flex justify-between">
                <span className="text-red-400 font-semibold">Đạm</span>
                <span>{currentPlanData.protein}g</span>
              </p>
              <p className="flex justify-between">
                <span className="text-green-400 font-semibold">Tinh bột</span>
                <span>{currentPlanData.carb}g</span>
              </p>
              <p className="flex justify-between">
                <span className="text-yellow-400 font-semibold">Chất béo</span>
                <span>{currentPlanData.fat}g</span>
              </p>
              <p className="flex justify-between border-t border-gray-700 pt-2 mt-2">
                <span className="text-orange-400 font-bold">Calories</span>
                <span className="text-orange-400 font-bold">
                  {Math.round(currentPlanData.calories).toLocaleString()} kcal
                </span>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Card số bữa */}
      <div className="w-full lg:w-80 bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 shadow-xl overflow-hidden hover:border-orange-500/50 transition">
        <div className="bg-gradient-to-r from-gray-700 to-gray-800 px-5 py-3 border-b border-gray-600">
          <h3 className="font-bold text-orange-400 flex items-center gap-2">
            <Coffee className="w-5 h-5" /> Số bữa/ngày
          </h3>
        </div>
        <div className="p-5">
          <select
            value={selectedPlan}
            onChange={(e) => setSelectedPlan(Number(e.target.value))}
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-xl text-white focus:ring-2 focus:ring-orange-500"
          >
            {[3, 4, 5, 6].map((num) => (
              <option key={num} value={num}>
                {num} bữa
              </option>
            ))}
          </select>
          {selectedMacroPlan && currentPlanData && (
            <div className="mt-5 p-4 bg-gray-900/60 rounded-xl border border-gray-700 space-y-2">
              <p className="flex justify-between">
                <span className="text-red-400 font-semibold">Đạm/bữa</span>
                <span>
                  {Math.round(currentPlanData.protein / selectedPlan)}g
                </span>
              </p>
              <p className="flex justify-between">
                <span className="text-green-400 font-semibold">
                  Tinh bột/bữa
                </span>
                <span>{Math.round(currentPlanData.carb / selectedPlan)}g</span>
              </p>
              <p className="flex justify-between">
                <span className="text-yellow-400 font-semibold">
                  Chất béo/bữa
                </span>
                <span>{Math.round(currentPlanData.fat / selectedPlan)}g</span>
              </p>
              <p className="flex justify-between border-t border-gray-700 pt-2 mt-2">
                <span className="text-orange-400 font-bold">Calo/bữa</span>
                <span className="text-orange-400 font-bold">
                  {Math.round(currentPlanData.calories / selectedPlan)} kcal
                </span>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MealSelector;
