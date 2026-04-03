import { useState } from "react";
import { toast } from "react-toastify";

export const useMealGenerator = ({
  selectedPlan,
  targetMacros: propsTargetMacros,
  foodDatabase,
  customFoods = null,
}) => {
  const [meals, setMeals] = useState([]);
  const [totalMacros, setTotalMacros] = useState({
    protein: 0,
    carb: 0,
    fat: 0,
  });
  const [totalCalories, setTotalCalories] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);

  const getActiveDatabase = () => {
    if (!customFoods) return foodDatabase;

    const allowedIds = [
      ...(customFoods.carb || []),
      ...(customFoods.protein || []),
      ...(customFoods.fat || []),
    ];

    const filtered = foodDatabase.filter((food) =>
      allowedIds.includes(food._id),
    );

    if (filtered.length === 0) {
      toast.warning(
        "Danh sách thực phẩm đã chọn không có món nào. Hệ thống sẽ dùng toàn bộ thực phẩm.",
      );
      return foodDatabase;
    }

    return filtered;
  };

  const calcCalories = (p, c, f) => p * 4 + c * 4 + f * 9;
  const round1 = (num) => Math.round(num * 10) / 10;
  const roundInt = (num) => Math.round(num);

  const getFoodKey = (food) => food.label || food.name;

  const classifyFood = (food) => {
    const protein = Number(food.protein || 0);
    const carb = Number(food.carb || 0);
    const fat = Number(food.fat || 0);
    const max = Math.max(protein, carb, fat);
    if (max === protein) return "protein";
    if (max === carb) return "carb";
    return "fat";
  };

  const getMealType = (index, totalMeals) => {
    if (totalMeals <= 3) {
      if (index === 0) return "breakfast";
      if (index === totalMeals - 1) return "dinner";
      return "lunch";
    }
    if (totalMeals === 4) {
      if (index === 0) return "breakfast";
      if (index === 1) return "lunch";
      if (index === 2) return "snack";
      return "dinner";
    }
    if (index === 0) return "breakfast";
    if (index === 1) return "lunch";
    if (index === 2) return "snack";
    if (index === 3) return "dinner";
    return "snack";
  };

  const mealCategoryRules = {
    breakfast: {
      carb: ["main_carb", "light_carb"],
      protein: [
        "animal_protein",
        "dairy_protein",
        "supplement_protein",
        "plant_protein",
      ],
      fat: ["cooking_fat", "whole_food_fat"],
    },
    lunch: {
      carb: ["main_carb"],
      protein: ["animal_protein", "plant_protein", "dairy_protein"],
      fat: ["cooking_fat"],
    },
    dinner: {
      carb: ["main_carb"],
      protein: ["animal_protein", "plant_protein", "dairy_protein"],
      fat: ["cooking_fat"],
    },
    snack: {
      carb: ["fruit", "light_carb"],
      protein: [
        "dairy_protein",
        "supplement_protein",
        "animal_protein",
        "plant_protein",
      ],
      fat: ["whole_food_fat", "cooking_fat"],
    },
  };

  const getFoodsByGroup = (group, usedKeys = [], allowedCategories = []) => {
    const activeDB = getActiveDatabase();
    let filtered = activeDB.filter((f) => {
      const sameGroup = classifyFood(f) === group;
      const notUsed = !usedKeys.includes(getFoodKey(f));
      const matchCategory =
        allowedCategories.length === 0 ||
        allowedCategories.includes(f.category);
      return sameGroup && notUsed && matchCategory;
    });
    if (filtered.length === 0) {
      filtered = activeDB.filter((f) => {
        const sameGroup = classifyFood(f) === group;
        const matchCategory =
          allowedCategories.length === 0 ||
          allowedCategories.includes(f.category);
        return sameGroup && matchCategory;
      });
    }
    if (filtered.length === 0) {
      filtered = activeDB.filter(
        (f) => classifyFood(f) === group && !usedKeys.includes(getFoodKey(f)),
      );
    }
    if (filtered.length === 0) {
      filtered = activeDB.filter((f) => classifyFood(f) === group);
    }
    return [...filtered].sort((a, b) => {
      const priorityDiff = (b.priority || 0) - (a.priority || 0);
      if (priorityDiff !== 0) return priorityDiff;
      return Math.random() - 0.5;
    });
  };

  const getBoundsByGroup = (group) => {
    if (group === "protein") return { min: 60, max: 220 };
    if (group === "carb") return { min: 80, max: 350 };
    return { min: 5, max: 30 };
  };

  const getBoundsByFood = (food) => {
    const name = (food?.name || "").toLowerCase();
    const category = food?.category || "";
    if (name.includes("whey")) return { min: 20, max: 50 };
    if (category === "cooking_fat" || name.includes("dầu"))
      return { min: 5, max: 15 };
    if (name.includes("bơ đậu phộng") || name.includes("bơ hạnh nhân"))
      return { min: 10, max: 25 };
    if (category === "fruit") return { min: 80, max: 250 };
    if (
      name.includes("gạo") ||
      name.includes("cơm") ||
      name.includes("bún") ||
      name.includes("phở") ||
      name.includes("miến") ||
      name.includes("yến mạch") ||
      name.includes("pasta") ||
      name.includes("khoai") ||
      category === "main_carb" ||
      category === "light_carb"
    ) {
      return { min: 80, max: 320 };
    }
    if (
      name.includes("cá") ||
      name.includes("gà") ||
      name.includes("bò") ||
      name.includes("heo") ||
      name.includes("tôm") ||
      name.includes("tempeh") ||
      name.includes("đậu phụ") ||
      name.includes("trứng") ||
      category === "animal_protein" ||
      category === "plant_protein" ||
      category === "dairy_protein"
    ) {
      return { min: 60, max: 220 };
    }
    return getBoundsByGroup(food?.group);
  };

  const clampAmountByFood = (food, amount) => {
    const { min, max } = getBoundsByFood(food);
    return Math.min(max, Math.max(min, amount));
  };

  const selectFoodForGroup = (
    group,
    needGram,
    usedKeys,
    allowedCategories = [],
  ) => {
    const foods = getFoodsByGroup(group, usedKeys, allowedCategories);
    if (foods.length === 0) return null;
    for (const food of foods) {
      const protein = Number(food.protein || 0);
      const carb = Number(food.carb || 0);
      const fat = Number(food.fat || 0);
      let divisor = 0;
      if (group === "protein") divisor = protein;
      if (group === "carb") divisor = carb;
      if (group === "fat") divisor = fat;
      if (divisor <= 0) continue;
      let amount = (needGram / divisor) * 100;
      const candidate = { ...food, group, amount: 0 };
      amount = clampAmountByFood(candidate, amount);
      return { ...food, group, amount: roundInt(amount) };
    }
    return null;
  };

  const getFoodMacrosByAmount = (food) => {
    if (!food) return { protein: 0, carb: 0, fat: 0, calories: 0 };
    const protein = (Number(food.protein || 0) * food.amount) / 100;
    const carb = (Number(food.carb || 0) * food.amount) / 100;
    const fat = (Number(food.fat || 0) * food.amount) / 100;
    const calories = calcCalories(protein, carb, fat);
    return {
      protein: round1(protein),
      carb: round1(carb),
      fat: round1(fat),
      calories: round1(calories),
    };
  };

  const getMealTotals = (mealFoods) => {
    const totals = mealFoods.reduce(
      (acc, food) => {
        const m = getFoodMacrosByAmount(food);
        acc.protein += m.protein;
        acc.carb += m.carb;
        acc.fat += m.fat;
        acc.calories += m.calories;
        return acc;
      },
      { protein: 0, carb: 0, fat: 0, calories: 0 },
    );
    return {
      protein: round1(totals.protein),
      carb: round1(totals.carb),
      fat: round1(totals.fat),
      calories: round1(totals.calories),
    };
  };

  const adjustFoodAmount = (food, deltaGram) => {
    if (!food) return food;
    const nextAmount = clampAmountByFood(food, food.amount + deltaGram);
    return { ...food, amount: roundInt(nextAmount) };
  };

  const isDenseProtein = (food) => {
    if (!food) return false;
    const name = (food.name || "").toLowerCase();
    return (
      name.includes("whey") ||
      name.includes("tempeh") ||
      name.includes("cá hồi") ||
      name.includes("cá thu") ||
      name.includes("cá mòi")
    );
  };

  const tuneMealToCalories = (mealFoods, targetCalories) => {
    let foods = mealFoods.map((f) => (f ? { ...f } : null));
    let totals = getMealTotals(foods.filter(Boolean));
    const tolerance = 15;
    let safeGuard = 0;
    while (
      Math.abs(totals.calories - targetCalories) > tolerance &&
      safeGuard < 150
    ) {
      safeGuard += 1;
      const diff = totals.calories - targetCalories;
      let proteinFood = foods.find((f) => f?.group === "protein") || null;
      let carbFood = foods.find((f) => f?.group === "carb") || null;
      let fatFood = foods.find((f) => f?.group === "fat") || null;
      if (diff > 0) {
        if (fatFood && fatFood.amount > getBoundsByFood(fatFood).min) {
          fatFood = adjustFoodAmount(fatFood, -1);
        } else if (
          proteinFood &&
          isDenseProtein(proteinFood) &&
          proteinFood.amount > getBoundsByFood(proteinFood).min
        ) {
          proteinFood = adjustFoodAmount(proteinFood, -1);
        } else if (
          carbFood &&
          carbFood.amount > getBoundsByFood(carbFood).min
        ) {
          carbFood = adjustFoodAmount(carbFood, -1);
        } else if (
          proteinFood &&
          proteinFood.amount > getBoundsByFood(proteinFood).min
        ) {
          proteinFood = adjustFoodAmount(proteinFood, -1);
        } else break;
      } else {
        if (carbFood && carbFood.amount < getBoundsByFood(carbFood).max) {
          carbFood = adjustFoodAmount(carbFood, +1);
        } else if (
          proteinFood &&
          proteinFood.amount < getBoundsByFood(proteinFood).max
        ) {
          proteinFood = adjustFoodAmount(proteinFood, +1);
        } else if (fatFood && fatFood.amount < getBoundsByFood(fatFood).max) {
          fatFood = adjustFoodAmount(fatFood, +1);
        } else break;
      }
      foods = [proteinFood, carbFood, fatFood];
      totals = getMealTotals(foods.filter(Boolean));
    }
    return { foods, totals };
  };

  const recalcMealsWithTotals = (mealsInput) => {
    return mealsInput.map((meal, index) => {
      const foods = [meal.proteinFood, meal.carbFood, meal.fatFood].filter(
        Boolean,
      );
      const totals = getMealTotals(foods);
      return {
        ...meal,
        mealName: meal.mealName || `Bữa ${index + 1}`,
        key: meal.key || `meal-${index + 1}`,
        proteinFood: meal.proteinFood ? { ...meal.proteinFood } : null,
        carbFood: meal.carbFood ? { ...meal.carbFood } : null,
        fatFood: meal.fatFood ? { ...meal.fatFood } : null,
        totalProtein: round1(totals.protein),
        totalCarb: round1(totals.carb),
        totalFat: round1(totals.fat),
        totalCalories: round1(totals.calories),
      };
    });
  };

  const getDayTotals = (mealsInput) => {
    return mealsInput.reduce(
      (acc, meal) => ({
        protein: acc.protein + Number(meal.totalProtein || 0),
        carb: acc.carb + Number(meal.totalCarb || 0),
        fat: acc.fat + Number(meal.totalFat || 0),
        calories: acc.calories + Number(meal.totalCalories || 0),
      }),
      { protein: 0, carb: 0, fat: 0, calories: 0 },
    );
  };

  const pickMealIndexForAdjustment = (mealsInput, mode, priority) => {
    let bestIndex = -1;
    let bestScore = mode === "reduce" ? -Infinity : Infinity;
    mealsInput.forEach((meal, index) => {
      const food = meal[priority];
      if (!food) return;
      const bounds = getBoundsByFood(food);
      if (mode === "reduce") {
        if (food.amount <= bounds.min) return;
        if (meal.totalCalories > bestScore) {
          bestScore = meal.totalCalories;
          bestIndex = index;
        }
      } else {
        if (food.amount >= bounds.max) return;
        if (meal.totalCalories < bestScore) {
          bestScore = meal.totalCalories;
          bestIndex = index;
        }
      }
    });
    return bestIndex;
  };

  const fineTuneDayCalories = (mealsInput, targetCalories) => {
    let mealsDraft = mealsInput.map((meal) => ({
      ...meal,
      proteinFood: meal.proteinFood ? { ...meal.proteinFood } : null,
      carbFood: meal.carbFood ? { ...meal.carbFood } : null,
      fatFood: meal.fatFood ? { ...meal.fatFood } : null,
    }));
    mealsDraft = recalcMealsWithTotals(mealsDraft);
    let dayTotals = getDayTotals(mealsDraft);
    const tolerance = 10;
    let safeGuard = 0;
    while (
      Math.abs(dayTotals.calories - targetCalories) > tolerance &&
      safeGuard < 800
    ) {
      safeGuard += 1;
      const diff = dayTotals.calories - targetCalories;
      if (diff > 0) {
        let idx = pickMealIndexForAdjustment(mealsDraft, "reduce", "fatFood");
        if (idx === -1)
          idx = mealsDraft.findIndex(
            (meal) =>
              meal.proteinFood &&
              isDenseProtein(meal.proteinFood) &&
              meal.proteinFood.amount > getBoundsByFood(meal.proteinFood).min,
          );
        if (idx === -1)
          idx = pickMealIndexForAdjustment(mealsDraft, "reduce", "carbFood");
        if (idx === -1)
          idx = pickMealIndexForAdjustment(mealsDraft, "reduce", "proteinFood");
        if (idx === -1) break;
        const meal = mealsDraft[idx];
        if (
          meal.fatFood &&
          meal.fatFood.amount > getBoundsByFood(meal.fatFood).min
        ) {
          meal.fatFood = adjustFoodAmount(meal.fatFood, -1);
        } else if (
          meal.proteinFood &&
          isDenseProtein(meal.proteinFood) &&
          meal.proteinFood.amount > getBoundsByFood(meal.proteinFood).min
        ) {
          meal.proteinFood = adjustFoodAmount(meal.proteinFood, -1);
        } else if (
          meal.carbFood &&
          meal.carbFood.amount > getBoundsByFood(meal.carbFood).min
        ) {
          meal.carbFood = adjustFoodAmount(meal.carbFood, -1);
        } else if (
          meal.proteinFood &&
          meal.proteinFood.amount > getBoundsByFood(meal.proteinFood).min
        ) {
          meal.proteinFood = adjustFoodAmount(meal.proteinFood, -1);
        } else break;
      } else {
        let idx = pickMealIndexForAdjustment(
          mealsDraft,
          "increase",
          "carbFood",
        );
        if (idx === -1)
          idx = pickMealIndexForAdjustment(
            mealsDraft,
            "increase",
            "proteinFood",
          );
        if (idx === -1)
          idx = pickMealIndexForAdjustment(mealsDraft, "increase", "fatFood");
        if (idx === -1) break;
        const meal = mealsDraft[idx];
        if (
          meal.carbFood &&
          meal.carbFood.amount < getBoundsByFood(meal.carbFood).max
        ) {
          meal.carbFood = adjustFoodAmount(meal.carbFood, +1);
        } else if (
          meal.proteinFood &&
          meal.proteinFood.amount < getBoundsByFood(meal.proteinFood).max
        ) {
          meal.proteinFood = adjustFoodAmount(meal.proteinFood, +1);
        } else if (
          meal.fatFood &&
          meal.fatFood.amount < getBoundsByFood(meal.fatFood).max
        ) {
          meal.fatFood = adjustFoodAmount(meal.fatFood, +1);
        } else break;
      }
      mealsDraft = recalcMealsWithTotals(mealsDraft);
      dayTotals = getDayTotals(mealsDraft);
    }
    return { meals: mealsDraft, totals: dayTotals };
  };

  const mapFoodData = (food) =>
    food
      ? {
          name: food.name,
          label: food.label,
          amount: food.amount,
          protein: food.protein,
          carb: food.carb,
          fat: food.fat,
          calories: food.calories,
          category: food.category,
          priority: food.priority,
          group: food.group,
        }
      : null;

  // ========== HÀM GENERATE CHÍNH - ĐÃ SỬA ĐỂ NHẬN forcedTarget ==========
  const generateMeals = (forcedTarget = null) => {
    // Ưu tiên dùng forcedTarget, nếu không thì dùng propsTargetMacros
    const target = forcedTarget || propsTargetMacros;

    if (
      !target ||
      target.protein == null ||
      target.carb == null ||
      target.fat == null
    ) {
      toast.error("Vui lòng chọn hoặc tinh chỉnh macro trước");
      return;
    }
    if (!foodDatabase || foodDatabase.length === 0) {
      toast.error("Chưa có dữ liệu thực phẩm");
      return;
    }
    setIsGenerating(true);
    try {
      const targetCalories = roundInt(
        Number(
          target.calories ||
            calcCalories(target.protein, target.carb, target.fat),
        ),
      );
      const proteinPerMeal = target.protein / selectedPlan;
      const carbPerMeal = target.carb / selectedPlan;
      const fatPerMeal = target.fat / selectedPlan;
      const caloriesPerMeal = targetCalories / selectedPlan;

      const usedKeys = { protein: [], carb: [], fat: [] };
      let mealsResult = [];

      for (let i = 0; i < selectedPlan; i++) {
        const mealType = getMealType(i, selectedPlan);
        const categoryRule = mealCategoryRules[mealType];
        let proteinFood = selectFoodForGroup(
          "protein",
          proteinPerMeal,
          usedKeys.protein,
          categoryRule?.protein || [],
        );
        if (proteinFood) usedKeys.protein.push(getFoodKey(proteinFood));
        let carbFood = selectFoodForGroup(
          "carb",
          carbPerMeal,
          usedKeys.carb,
          categoryRule?.carb || [],
        );
        if (carbFood) usedKeys.carb.push(getFoodKey(carbFood));
        let fatFood = selectFoodForGroup(
          "fat",
          fatPerMeal,
          usedKeys.fat,
          categoryRule?.fat || [],
        );
        if (fatFood) usedKeys.fat.push(getFoodKey(fatFood));
        const tunedMeal = tuneMealToCalories(
          [proteinFood, carbFood, fatFood].filter(Boolean),
          caloriesPerMeal,
        );
        mealsResult.push({
          mealName: `Bữa ${i + 1}`,
          key: `meal-${i + 1}`,
          mealType,
          proteinFood: mapFoodData(
            tunedMeal.foods.find((f) => f?.group === "protein"),
          ),
          carbFood: mapFoodData(
            tunedMeal.foods.find((f) => f?.group === "carb"),
          ),
          fatFood: mapFoodData(tunedMeal.foods.find((f) => f?.group === "fat")),
          totalProtein: tunedMeal.totals.protein,
          totalCarb: tunedMeal.totals.carb,
          totalFat: tunedMeal.totals.fat,
          totalCalories: tunedMeal.totals.calories,
        });
      }
      mealsResult = recalcMealsWithTotals(mealsResult);
      const fineTuned = fineTuneDayCalories(mealsResult, targetCalories);
      setMeals(fineTuned.meals);
      setTotalMacros({
        protein: roundInt(fineTuned.totals.protein),
        carb: roundInt(fineTuned.totals.carb),
        fat: roundInt(fineTuned.totals.fat),
      });
      setTotalCalories(roundInt(fineTuned.totals.calories));
      toast.success("Tạo thực đơn thành công!");
    } catch (err) {
      console.error(err);
      toast.error("Lỗi tạo thực đơn: " + err.message);
    } finally {
      setIsGenerating(false);
    }
  };
  // =============================================================

  return {
    generateMeals,
    meals,
    totalMacros,
    totalCalories,
    isGenerating,
  };
};
