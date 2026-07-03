// Suggest Meal Tool — Gợi ý thực đơn từ Food database

import Food from "../../../models/Food.js";

/**
 * Gợi ý thực đơn dựa trên macro mục tiêu
 * @param {{ targetCalories, proteinGrams, carbGrams, fatGrams, mealsPerDay? }} params
 * @returns {{ text: string, uiCard: object }}
 */
export async function suggestMeal(params) {
  const { targetCalories, proteinGrams, carbGrams, fatGrams, mealsPerDay = 3 } = params;

  // Lấy thực phẩm từ DB, chia theo nhóm macro chính
  const highProteinFoods = await Food.find({ protein: { $gte: 15 } }).sort({ protein: -1 }).limit(10).lean();
  const highCarbFoods = await Food.find({ carb: { $gte: 20 } }).sort({ carb: -1 }).limit(10).lean();
  const healthyFatFoods = await Food.find({ fat: { $gte: 5, $lte: 30 } }).sort({ fat: -1 }).limit(8).lean();

  if (highProteinFoods.length === 0 && highCarbFoods.length === 0) {
    return {
      text: "Hiện tại chưa có đủ dữ liệu thực phẩm trong hệ thống để gợi ý thực đơn.",
      uiCard: null,
    };
  }

  // Phân bổ macro theo bữa
  const perMeal = {
    calories: Math.round(targetCalories / mealsPerDay),
    protein: Math.round(proteinGrams / mealsPerDay),
    carb: Math.round(carbGrams / mealsPerDay),
    fat: Math.round(fatGrams / mealsPerDay),
  };

  // Gợi ý đơn giản: chọn 1 protein + 1 carb + 1 fat cho mỗi bữa
  const meals = [];
  for (let i = 0; i < mealsPerDay; i++) {
    const protein = highProteinFoods[i % highProteinFoods.length];
    const carb = highCarbFoods[i % highCarbFoods.length];
    const fat = healthyFatFoods[i % healthyFatFoods.length];

    const mealFoods = [protein, carb, fat].filter(Boolean);
    meals.push({
      mealNumber: i + 1,
      label: getMealLabel(i, mealsPerDay),
      foods: mealFoods.map((f) => ({
        name: f.label,
        calories: f.calories,
        protein: f.protein,
        carb: f.carb,
        fat: f.fat,
      })),
      targetMacro: perMeal,
    });
  }

  // Text cho LLM
  const mealText = meals
    .map((m) => {
      const foodList = m.foods.map((f) => `${f.name} (${f.calories} kcal)`).join(", ");
      return `${m.label}: ${foodList}`;
    })
    .join("\n");

  const text =
    `Gợi ý thực đơn ${mealsPerDay} bữa/ngày (${targetCalories} kcal):\n${mealText}\n` +
    `Mỗi bữa khoảng: ${perMeal.protein}g protein, ${perMeal.carb}g carb, ${perMeal.fat}g fat.`;

  const uiCard = {
    cardType: "meal",
    data: {
      targetCalories,
      macros: { protein: proteinGrams, carb: carbGrams, fat: fatGrams },
      mealsPerDay,
      meals,
    },
  };

  return { text, uiCard };
}

function getMealLabel(index, total) {
  if (total <= 3) return ["Bữa sáng", "Bữa trưa", "Bữa tối"][index] || `Bữa ${index + 1}`;
  if (total === 4) return ["Bữa sáng", "Bữa trưa", "Bữa phụ", "Bữa tối"][index];
  return `Bữa ${index + 1}`;
}
