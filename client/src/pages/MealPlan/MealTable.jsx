import React from "react";
import { Wheat, Drumstick, Fish } from "lucide-react";

const MealTable = ({ meals = [] }) => {
  if (!meals.length) {
    return (
      <div className="text-center py-12 text-gray-400 bg-gray-800/30 rounded-2xl border border-gray-700">
        🍽️ Chưa có thực đơn. Hãy chọn chế độ và nhấn "Gợi ý thực đơn mẫu".
      </div>
    );
  }

  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0 mt-6">
      <div className="min-w-[700px] sm:min-w-full">
        <table className="w-full bg-gray-800/40 rounded-2xl border border-gray-700 shadow-lg">
          <thead className="bg-gray-700/60">
            <tr>
              <th className="px-3 sm:px-5 py-3 text-left text-orange-300 font-bold border-b border-gray-600 text-sm sm:text-base">
                Bữa ăn
              </th>
              <th className="px-3 sm:px-5 py-3 text-left text-green-300 font-bold border-b border-gray-600">
                <Wheat className="w-4 h-4 inline mr-1" /> Tinh bột
              </th>
              <th className="px-3 sm:px-5 py-3 text-left text-red-300 font-bold border-b border-gray-600">
                <Drumstick className="w-4 h-4 inline mr-1" /> Đạm
              </th>
              <th className="px-3 sm:px-5 py-3 text-left text-yellow-300 font-bold border-b border-gray-600">
                <Fish className="w-4 h-4 inline mr-1" /> Chất béo
              </th>
              <th className="px-3 sm:px-5 py-3 text-left text-orange-300 font-bold border-b border-gray-600">
                Calo
              </th>
            </tr>
          </thead>
          <tbody>
            {meals.map((meal, idx) => (
              <tr
                key={idx}
                className="border-b border-gray-700 hover:bg-gray-700/30 transition"
              >
                <td className="px-3 sm:px-5 py-3 sm:py-4 font-semibold text-white text-sm sm:text-base">
                  {meal.mealName}
                </td>
                <td className="px-3 sm:px-5 py-3 sm:py-4 text-xs sm:text-sm">
                  {meal.carbFood ? (
                    <div>
                      <div className="font-medium text-green-300">
                        {meal.carbFood.label || meal.carbFood.name}
                        <span className="ml-1 text-gray-400">
                          ({meal.carbFood.amount}g)
                        </span>
                      </div>
                      <div className="mt-1 text-gray-400 text-xs">
                        P:{" "}
                        {(
                          ((meal.carbFood.protein || 0) *
                            (meal.carbFood.amount || 0)) /
                          100
                        ).toFixed(1)}
                        g | C:{" "}
                        {(
                          ((meal.carbFood.carb || 0) *
                            (meal.carbFood.amount || 0)) /
                          100
                        ).toFixed(1)}
                        g | F:{" "}
                        {(
                          ((meal.carbFood.fat || 0) *
                            (meal.carbFood.amount || 0)) /
                          100
                        ).toFixed(1)}
                        g
                      </div>
                    </div>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 sm:px-5 py-3 sm:py-4 text-xs sm:text-sm">
                  {meal.proteinFood ? (
                    <div>
                      <div className="font-medium text-red-300">
                        {meal.proteinFood.label || meal.proteinFood.name}
                        <span className="ml-1 text-gray-400">
                          ({meal.proteinFood.amount}g)
                        </span>
                      </div>
                      <div className="mt-1 text-gray-400 text-xs">
                        P:{" "}
                        {(
                          ((meal.proteinFood.protein || 0) *
                            (meal.proteinFood.amount || 0)) /
                          100
                        ).toFixed(1)}
                        g | C:{" "}
                        {(
                          ((meal.proteinFood.carb || 0) *
                            (meal.proteinFood.amount || 0)) /
                          100
                        ).toFixed(1)}
                        g | F:{" "}
                        {(
                          ((meal.proteinFood.fat || 0) *
                            (meal.proteinFood.amount || 0)) /
                          100
                        ).toFixed(1)}
                        g
                      </div>
                    </div>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 sm:px-5 py-3 sm:py-4 text-xs sm:text-sm">
                  {meal.fatFood ? (
                    <div>
                      <div className="font-medium text-yellow-300">
                        {meal.fatFood.label || meal.fatFood.name}
                        <span className="ml-1 text-gray-400">
                          ({meal.fatFood.amount}g)
                        </span>
                      </div>
                      <div className="mt-1 text-gray-400 text-xs">
                        P:{" "}
                        {(
                          ((meal.fatFood.protein || 0) *
                            (meal.fatFood.amount || 0)) /
                          100
                        ).toFixed(1)}
                        g | C:{" "}
                        {(
                          ((meal.fatFood.carb || 0) *
                            (meal.fatFood.amount || 0)) /
                          100
                        ).toFixed(1)}
                        g | F:{" "}
                        {(
                          ((meal.fatFood.fat || 0) *
                            (meal.fatFood.amount || 0)) /
                          100
                        ).toFixed(1)}
                        g
                      </div>
                    </div>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 sm:px-5 py-3 sm:py-4 font-bold text-orange-400 text-sm sm:text-base">
                  {meal.totalCalories} kcal
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MealTable;
