import React from "react";
import { Wheat, Drumstick, Fish } from "lucide-react";

const round1 = (num) => Math.round(num * 10) / 10;
const calcCalories = (p, c, f) => round1(p * 4 + c * 4 + f * 9);

const getFoodDisplayMacros = (food) => {
  if (!food) return null;
  const p = round1(((food.protein || 0) * (food.amount || 0)) / 100);
  const c = round1(((food.carb || 0) * (food.amount || 0)) / 100);
  const f = round1(((food.fat || 0) * (food.amount || 0)) / 100);
  return { p, c, f, cal: calcCalories(p, c, f) };
};

const FoodCell = ({ food, colorClass }) => {
  if (!food) return "—";
  const m = getFoodDisplayMacros(food);
  return (
    <div>
      <div className={`font-medium ${colorClass}`}>
        {food.label || food.name}
        <span className="ml-1 text-gray-400">({food.amount}g)</span>
      </div>
      <div className="mt-1 text-gray-400 text-xs">
        P: {m.p}g | C: {m.c}g | F: {m.f}g
      </div>
    </div>
  );
};

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
              <th className="px-3 sm:px-5 py-3 text-left text-primary font-bold border-b border-gray-600 text-fluid-sm">
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
              <th className="px-3 sm:px-5 py-3 text-left text-primary font-bold border-b border-gray-600">
                Calo
              </th>
            </tr>
          </thead>
          <tbody>
            {meals.map((meal, idx) => {
              // Tính Calo bữa trực tiếp từ P/C/F hiển thị để khớp 100%
              const foods = [meal.carbFood, meal.proteinFood, meal.fatFood];
              let mealP = 0, mealC = 0, mealF = 0;
              foods.forEach((food) => {
                const m = getFoodDisplayMacros(food);
                if (m) { mealP += m.p; mealC += m.c; mealF += m.f; }
              });
              const mealCal = calcCalories(round1(mealP), round1(mealC), round1(mealF));

              return (
                <tr
                  key={idx}
                  className="border-b border-gray-700 hover:bg-gray-700/30 transition"
                >
                  <td className="px-3 sm:px-5 py-3 sm:py-4 font-semibold text-white text-fluid-sm">
                    {meal.mealName}
                  </td>
                  <td className="px-3 sm:px-5 py-3 sm:py-4 text-fluid-xs">
                    <FoodCell food={meal.carbFood} colorClass="text-green-300" />
                  </td>
                  <td className="px-3 sm:px-5 py-3 sm:py-4 text-fluid-xs">
                    <FoodCell food={meal.proteinFood} colorClass="text-red-300" />
                  </td>
                  <td className="px-3 sm:px-5 py-3 sm:py-4 text-fluid-xs">
                    <FoodCell food={meal.fatFood} colorClass="text-yellow-300" />
                  </td>
                  <td className="px-3 sm:px-5 py-3 sm:py-4 font-bold text-primary text-fluid-sm">
                    {mealCal} kcal
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MealTable;
