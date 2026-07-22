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
  const getFoodName = (food) => food?.label || food?.name || "";

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
    if (group === "protein") return { min: 20, max: 250 };
    if (group === "carb") return { min: 20, max: 350 };
    return { min: 2, max: 80 };
  };

  const getBoundsByFood = (food) => {
    const name = getFoodName(food).toLowerCase();
    const category = food?.category || "";
    if (name.includes("whey")) return { min: 10, max: 60 };
    if (category === "cooking_fat" || name.includes("dầu"))
      return { min: 2, max: 60 };
    if (name.includes("bơ đậu phộng") || name.includes("bơ hạnh nhân"))
      return { min: 5, max: 70 };
    if (category === "fruit") return { min: 40, max: 250 };
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
      return { min: 30, max: 320 };
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
      return { min: 30, max: 250 };
    }
    return getBoundsByGroup(food?.group);
  };

  const clampAmountByFood = (food, amount) => {
    const { min, max } = getBoundsByFood(food);
    return roundInt(Math.min(max, Math.max(min, amount)));
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
    const protein = round1((Number(food.protein || 0) * food.amount) / 100);
    const carb = round1((Number(food.carb || 0) * food.amount) / 100);
    const fat = round1((Number(food.fat || 0) * food.amount) / 100);
    const calories = round1(calcCalories(protein, carb, fat));
    return {
      protein,
      carb,
      fat,
      calories,
    };
  };

  const getMealTotals = (mealFoods) => {
    const totals = mealFoods.reduce(
      (acc, food) => {
        const m = getFoodMacrosByAmount(food);
        acc.protein += m.protein;
        acc.carb += m.carb;
        acc.fat += m.fat;
        return acc;
      },
      { protein: 0, carb: 0, fat: 0 },
    );
    
    const finalP = round1(totals.protein);
    const finalC = round1(totals.carb);
    const finalF = round1(totals.fat);

    return {
      protein: finalP,
      carb: finalC,
      fat: finalF,
      calories: round1(calcCalories(finalP, finalC, finalF)),
    };
  };

  const adjustFoodAmount = (food, deltaGram) => {
    if (!food) return food;
    const nextAmount = clampAmountByFood(food, food.amount + deltaGram);
    return { ...food, amount: roundInt(nextAmount) };
  };

  const isDenseProtein = (food) => {
    if (!food) return false;
    const name = getFoodName(food).toLowerCase();
    return (
      name.includes("whey") ||
      name.includes("tempeh") ||
      name.includes("cá hồi") ||
      name.includes("cá thu") ||
      name.includes("cá mòi")
    );
  };

  const _tuneMealToCalories = (mealFoods, targetCalories) => {
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

  const _fineTuneDayCalories = (mealsInput, targetCalories) => {
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

  const getMacroScore = (totals, target, targetCalories) => {
    const proteinDiff = Number(totals.protein || 0) - Number(target.protein);
    const carbDiff = Number(totals.carb || 0) - Number(target.carb);
    const fatDiff = Number(totals.fat || 0) - Number(target.fat);
    const calorieDiff = Number(totals.calories || 0) - targetCalories;

    return (
      proteinDiff * proteinDiff +
      carbDiff * carbDiff +
      fatDiff * fatDiff +
      (calorieDiff * calorieDiff) / 400
    );
  };

  const isMacroCloseEnough = (totals, target) => {
    const tolerance = 3;
    return (
      Math.abs(Number(totals.protein || 0) - Number(target.protein)) <=
        tolerance &&
      Math.abs(Number(totals.carb || 0) - Number(target.carb)) <= tolerance &&
      Math.abs(Number(totals.fat || 0) - Number(target.fat)) <= tolerance
    );
  };

  const fineTuneDayMacros = (mealsInput, target, targetCalories) => {
    let mealsDraft = mealsInput.map((meal) => ({
      ...meal,
      proteinFood: meal.proteinFood ? { ...meal.proteinFood } : null,
      carbFood: meal.carbFood ? { ...meal.carbFood } : null,
      fatFood: meal.fatFood ? { ...meal.fatFood } : null,
    }));

    mealsDraft = recalcMealsWithTotals(mealsDraft);

    const foodKeys = ["proteinFood", "carbFood", "fatFood"];
    const steps = [10, 5, 2, 1];

    for (const step of steps) {
      let safeGuard = 0;
      while (safeGuard < 3000) {
        safeGuard += 1;

        const currentTotals = getDayTotals(mealsDraft);
        if (step === 1 && isMacroCloseEnough(currentTotals, target)) break;

        const currentScore = getMacroScore(
          currentTotals,
          target,
          targetCalories,
        );
        let bestMove = null;
        let bestScore = currentScore;

        mealsDraft.forEach((meal, mealIndex) => {
          foodKeys.forEach((foodKey) => {
            const food = meal[foodKey];
            if (!food) return;

            [-step, step].forEach((delta) => {
              const nextAmount = clampAmountByFood(food, food.amount + delta);
              if (nextAmount === food.amount) return;

              const candidateMeals = mealsDraft.map((draftMeal, index) => {
                if (index !== mealIndex) return draftMeal;

                return {
                  ...draftMeal,
                  [foodKey]: { ...food, amount: nextAmount },
                };
              });
              const candidateTotals = getDayTotals(
                recalcMealsWithTotals(candidateMeals),
              );
              const candidateScore = getMacroScore(
                candidateTotals,
                target,
                targetCalories,
              );

              if (candidateScore < bestScore) {
                bestScore = candidateScore;
                bestMove = { mealIndex, foodKey, nextAmount };
              }
            });
          });
        });

        if (!bestMove) break;

        mealsDraft[bestMove.mealIndex] = {
          ...mealsDraft[bestMove.mealIndex],
          [bestMove.foodKey]: {
            ...mealsDraft[bestMove.mealIndex][bestMove.foodKey],
            amount: bestMove.nextAmount,
          },
        };
        mealsDraft = recalcMealsWithTotals(mealsDraft);
      }
    }

    return { meals: mealsDraft, totals: getDayTotals(mealsDraft) };
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

  const solveMealAmounts = (proteinFood, carbFood, fatFood, targetP, targetC, targetF) => {
    if (!proteinFood || !carbFood || !fatFood) return null;

    const pP = Number(proteinFood.protein || 0) / 100;
    const cP = Number(proteinFood.carb || 0) / 100;
    const fP = Number(proteinFood.fat || 0) / 100;

    const pC = Number(carbFood.protein || 0) / 100;
    const cC = Number(carbFood.carb || 0) / 100;
    const fC = Number(carbFood.fat || 0) / 100;

    const pF = Number(fatFood.protein || 0) / 100;
    const cF = Number(fatFood.carb || 0) / 100;
    const fF = Number(fatFood.fat || 0) / 100;

    const detMatrix = (m) =>
      m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
      m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
      m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);

    const D = detMatrix([
      [pP, pC, pF],
      [cP, cC, cF],
      [fP, fC, fF],
    ]);

    if (Math.abs(D) < 1e-6) return null;

    const Da = detMatrix([
      [targetP, pC, pF],
      [targetC, cC, cF],
      [targetF, fC, fF],
    ]);

    const Db = detMatrix([
      [pP, targetP, pF],
      [cP, targetC, cF],
      [fP, targetF, fF],
    ]);

    const Dc = detMatrix([
      [pP, pC, targetP],
      [cP, cC, targetC],
      [fP, fC, targetF],
    ]);

    return { amountA: Da / D, amountB: Db / D, amountC: Dc / D };
  };

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

      const usedKeys = { protein: [], carb: [], fat: [] };
      let mealsResult = [];

      for (let i = 0; i < selectedPlan; i++) {
        const mealType = getMealType(i, selectedPlan);
        const categoryRule = mealCategoryRules[mealType];

        const proteinOptions = getFoodsByGroup("protein", usedKeys.protein, categoryRule?.protein || []);
        const carbOptions = getFoodsByGroup("carb", usedKeys.carb, categoryRule?.carb || []);
        const fatOptions = getFoodsByGroup("fat", usedKeys.fat, categoryRule?.fat || []);

        let bestCombo = null;
        let bestScore = Infinity;

        for (let pIdx = 0; pIdx < Math.min(proteinOptions.length, 5); pIdx++) {
          for (let cIdx = 0; cIdx < Math.min(carbOptions.length, 5); cIdx++) {
             for (let fIdx = 0; fIdx < Math.min(fatOptions.length, 5); fIdx++) {
                const pFood = proteinOptions[pIdx];
                const cFood = carbOptions[cIdx];
                const fFood = fatOptions[fIdx];
                
                const amounts = solveMealAmounts(pFood, cFood, fFood, proteinPerMeal, carbPerMeal, fatPerMeal);
                if (amounts) {
                    const { amountA, amountB, amountC } = amounts;
                    let score = 0;
                    
                    if (amountA < 0) score += Math.abs(amountA) * 10;
                    if (amountB < 0) score += Math.abs(amountB) * 10;
                    if (amountC < 0) score += Math.abs(amountC) * 10;

                    const pBounds = getBoundsByFood(pFood);
                    if (amountA > pBounds.max) score += (amountA - pBounds.max);
                    if (amountA < pBounds.min && amountA > 0) score += (pBounds.min - amountA);

                    const cBounds = getBoundsByFood(cFood);
                    if (amountB > cBounds.max) score += (amountB - cBounds.max);
                    if (amountB < cBounds.min && amountB > 0) score += (cBounds.min - amountB);

                    const fBounds = getBoundsByFood(fFood);
                    if (amountC > fBounds.max) score += (amountC - fBounds.max);
                    if (amountC < fBounds.min && amountC > 0) score += (fBounds.min - amountC);

                    if (score < bestScore) {
                        bestScore = score;
                        bestCombo = { 
                            pFood: { ...pFood, group: "protein" }, 
                            cFood: { ...cFood, group: "carb" }, 
                            fFood: { ...fFood, group: "fat" }, 
                            amounts 
                        };
                    }
                }
                if (bestScore === 0) break;
             }
             if (bestScore === 0) break;
          }
          if (bestScore === 0) break;
        }

        let proteinFood = null;
        let carbFood = null;
        let fatFood = null;

        if (bestCombo) {
            proteinFood = bestCombo.pFood;
            carbFood = bestCombo.cFood;
            fatFood = bestCombo.fFood;
            
            proteinFood.amount = clampAmountByFood(proteinFood, bestCombo.amounts.amountA);
            carbFood.amount = clampAmountByFood(carbFood, bestCombo.amounts.amountB);
            fatFood.amount = clampAmountByFood(fatFood, bestCombo.amounts.amountC);
        } else {
            proteinFood = selectFoodForGroup("protein", proteinPerMeal, usedKeys.protein, categoryRule?.protein || []);
            carbFood = selectFoodForGroup("carb", carbPerMeal, usedKeys.carb, categoryRule?.carb || []);
            fatFood = selectFoodForGroup("fat", fatPerMeal, usedKeys.fat, categoryRule?.fat || []);
            if (proteinFood) proteinFood.amount = clampAmountByFood(proteinFood, proteinFood.amount || 0);
            if (carbFood) carbFood.amount = clampAmountByFood(carbFood, carbFood.amount || 0);
            if (fatFood) fatFood.amount = clampAmountByFood(fatFood, fatFood.amount || 0);
        }

        if (proteinFood) usedKeys.protein.push(getFoodKey(proteinFood));
        if (carbFood) usedKeys.carb.push(getFoodKey(carbFood));
        if (fatFood) usedKeys.fat.push(getFoodKey(fatFood));

        const mealFoods = [proteinFood, carbFood, fatFood].filter(Boolean);
        const mealTotals = getMealTotals(mealFoods);
        mealsResult.push({
          mealName: `Bữa ${i + 1}`,
          key: `meal-${i + 1}`,
          mealType,
          proteinFood: mapFoodData(
            mealFoods.find((f) => f?.group === "protein"),
          ),
          carbFood: mapFoodData(mealFoods.find((f) => f?.group === "carb")),
          fatFood: mapFoodData(mealFoods.find((f) => f?.group === "fat")),
          totalProtein: mealTotals.protein,
          totalCarb: mealTotals.carb,
          totalFat: mealTotals.fat,
          totalCalories: mealTotals.calories,
        });
      }
      mealsResult = recalcMealsWithTotals(mealsResult);
      const fineTuned = fineTuneDayMacros(mealsResult, target, targetCalories);
      setMeals(fineTuned.meals);
      const finalProtein = roundInt(fineTuned.totals.protein);
      const finalCarb = roundInt(fineTuned.totals.carb);
      const finalFat = roundInt(fineTuned.totals.fat);

      setTotalMacros({
        protein: finalProtein,
        carb: finalCarb,
        fat: finalFat,
      });
      // Tính toán Calo chuẩn chỉnh theo Macro để giao diện khớp 100%
      setTotalCalories(calcCalories(finalProtein, finalCarb, finalFat));
      toast.success("Tạo thực đơn thành công!");
    } catch (err) {
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
