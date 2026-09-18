// Suggest Meal Tool — server-authoritative meal math from the Food catalog.
import Food from "../../../models/Food.js";
import { getFoodMarketPriceMap } from "../../foodPrice.service.js";

const FOOD_PROJECTION = "_id label protein carb fat allergenProfile";
const MACRO_CALORIES = (macro) => 4 * macro.protein + 4 * macro.carb + 9 * macro.fat;
const round = (value) => Number(value.toFixed(1));

const mealLabels = (total) => {
  if (total <= 3) return ["Bữa sáng", "Bữa trưa", "Bữa tối"].slice(0, total);
  if (total === 4) return ["Bữa sáng", "Bữa trưa", "Bữa phụ chiều", "Bữa tối"];
  if (total === 5) return ["Bữa sáng", "Bữa phụ sáng", "Bữa trưa", "Bữa phụ chiều", "Bữa tối"];
  return Array.from({ length: total }, (_, index) => `Bữa ${index + 1}`);
};

const defaultFindFoods = async () => Food.find({}).select(FOOD_PROJECTION).lean();

const missingData = (reason, text) => ({
  text,
  uiCard: {
    cardType: "meal",
    data: { status: "missing_data", reason, meals: [], totals: null },
  },
});

const asFinite = (value) => {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const normalizeParams = (params = {}) => {
  const targetCalories = asFinite(params.targetCalories);
  const proteinGrams = asFinite(params.proteinGrams);
  const carbGrams = asFinite(params.carbGrams);
  const fatGrams = asFinite(params.fatGrams);
  const mealsPerDay = Number(params.mealsPerDay ?? 3);
  const targetToleranceCalories = Number(params.targetToleranceCalories ?? 100);
  const minimumProteinGrams = Number(params.minimumProteinGrams ?? proteinGrams);
  if (
    ![targetCalories, proteinGrams, carbGrams, fatGrams, minimumProteinGrams, targetToleranceCalories]
      .every((value) => Number.isFinite(value) && value >= 0) ||
    !Number.isInteger(mealsPerDay) || mealsPerDay < 1 || mealsPerDay > 6
  ) return null;
  return {
    targetCalories, proteinGrams, carbGrams, fatGrams, mealsPerDay,
    targetToleranceCalories, minimumProteinGrams,
    excludedFoods: Array.isArray(params.excludedFoods) ? params.excludedFoods : [],
    excludedAllergens: Array.isArray(params.excludedAllergens) ? params.excludedAllergens : [],
    lactoseFree: params.lactoseFree === true,
    budgetVndPerDay: params.budgetVndPerDay == null ? null : asFinite(params.budgetVndPerDay),
    allowedAdjustmentFoodIds: Array.isArray(params.allowedAdjustmentFoodIds) ? params.allowedAdjustmentFoodIds : [],
    allowedAdjustmentFoodNames: Array.isArray(params.allowedAdjustmentFoodNames) ? params.allowedAdjustmentFoodNames : [],
  };
};

const hasReviewedProfile = (food) => food.allergenProfile?.reviewStatus === "reviewed" &&
  typeof food.allergenProfile?.sourceType === "string" &&
  food.allergenProfile?.reviewedAt &&
  Array.isArray(food.allergenProfile?.contains) && Array.isArray(food.allergenProfile?.mayContain);

const allowedFood = (food, constraints) => {
  const label = String(food.label || "").toLocaleLowerCase("vi");
  if (constraints.requireSafetyMetadata && !hasReviewedProfile(food)) return false;
  if (constraints.excludedTerms.some((term) => label.includes(term))) return false;
  const allergens = new Set([
    ...(food.allergenProfile?.contains || []),
    ...(food.allergenProfile?.mayContain || []),
  ]);
  return !constraints.excludedAllergens.some((allergen) => allergens.has(allergen));
};

const buildSafetyEvidence = ({
  requireSafetyMetadata,
  excludedTerms,
  excludedAllergens,
}) => ({
  status: requireSafetyMetadata === true ? "verified" : "not_requested",
  reviewedCatalogRequired: requireSafetyMetadata === true,
  allergenConstraintsApplied: excludedAllergens.length > 0,
  excludedFoodConstraintsApplied: excludedTerms.length > 0,
});

const normalizeFood = (food) => {
  const protein = asFinite(food?.protein);
  const carb = asFinite(food?.carb);
  const fat = asFinite(food?.fat);
  if (!food?._id || !String(food.label || "").trim() || [protein, carb, fat].some((value) => value === null || value < 0)) return null;
  return { ...food, protein, carb, fat, label: String(food.label).trim() };
};

const solve3x3 = (matrix, vector) => {
  const rows = matrix.map((row, index) => [...row, vector[index]]);
  for (let column = 0; column < 3; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < 3; row += 1) {
      if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) pivot = row;
    }
    if (Math.abs(rows[pivot][column]) < 0.000001) return null;
    [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
    const divisor = rows[column][column];
    rows[column] = rows[column].map((value) => value / divisor);
    for (let row = 0; row < 3; row += 1) {
      if (row === column) continue;
      const factor = rows[row][column];
      rows[row] = rows[row].map((value, index) => value - factor * rows[column][index]);
    }
  }
  return rows.map((row) => row[3]);
};

const foodMacro = (food, amountGrams) => ({
  protein: round((food.protein * amountGrams) / 100),
  carb: round((food.carb * amountGrams) / 100),
  fat: round((food.fat * amountGrams) / 100),
});

const addMacros = (items) => items.reduce((total, item) => ({
  protein: round(total.protein + item.protein),
  carb: round(total.carb + item.carb),
  fat: round(total.fat + item.fat),
}), { protein: 0, carb: 0, fat: 0 });

const targetMacros = (params) => {
  const protein = Math.max(params.proteinGrams, params.minimumProteinGrams);
  const remainingCalories = params.targetCalories - 4 * protein;
  const flexibleCalories = 4 * params.carbGrams + 9 * params.fatGrams;
  if (remainingCalories < -params.targetToleranceCalories || flexibleCalories <= 0) return null;
  const carbCalories = remainingCalories * ((4 * params.carbGrams) / flexibleCalories);
  return { protein, carb: carbCalories / 4, fat: (remainingCalories - carbCalories) / 9 };
};

const topFoods = (foods, scorer) => [...foods]
  .sort((left, right) => scorer(right) - scorer(left) || left.label.localeCompare(right.label, "vi"))
  .slice(0, 12);

const choosePlan = (foods, target) => {
  const proteins = topFoods(foods, (food) => food.protein - food.carb * 0.1 - food.fat * 0.1);
  const carbs = topFoods(foods, (food) => food.carb - food.protein * 0.05 - food.fat * 0.1);
  const fats = topFoods(foods, (food) => food.fat - food.protein * 0.05 - food.carb * 0.05);
  let best = null;
  for (const proteinFood of proteins) for (const carbFood of carbs) for (const fatFood of fats) {
    const foodsForPlan = [proteinFood, carbFood, fatFood];
    if (new Set(foodsForPlan.map((food) => String(food._id))).size !== 3) continue;
    const amounts = solve3x3([
      foodsForPlan.map((food) => food.protein / 100),
      foodsForPlan.map((food) => food.carb / 100),
      foodsForPlan.map((food) => food.fat / 100),
    ], [target.protein, target.carb, target.fat]);
    if (!amounts || amounts.some((amount) => amount < 1 || amount > 3000 || !Number.isFinite(amount))) continue;
    const roundedAmounts = amounts.map((amount) => Math.round(amount));
    const totals = addMacros(foodsForPlan.map((food, index) => foodMacro(food, roundedAmounts[index])));
    const score = Math.abs(MACRO_CALORIES(totals) - MACRO_CALORIES(target)) + Math.max(0, target.protein - totals.protein) * 100;
    if (!best || score < best.score) best = { foods: foodsForPlan, amounts: roundedAmounts, score };
  }
  return best;
};

const splitAmount = (amount, count) => {
  const base = Math.floor((amount / count) * 10) / 10;
  const values = Array(count).fill(base);
  values[count - 1] = round(amount - base * (count - 1));
  return values;
};

const buildStructuredMeals = (plan, mealsPerDay) =>
  mealLabels(mealsPerDay).map((label, mealIndex) => {
    const foods = plan.foods.map((food, index) => {
      const amountGrams = splitAmount(plan.amounts[index], mealsPerDay)[mealIndex];
      const macros = foodMacro(food, amountGrams);
      return {
        foodId: String(food._id),
        name: food.label,
        amountGrams,
        macros,
        calories: round(MACRO_CALORIES(macros)),
      };
    });
    const macros = addMacros(foods.map((food) => food.macros));
    return {
      label,
      foods,
      totals: { ...macros, calories: round(MACRO_CALORIES(macros)) },
    };
  });

const summarizeMeals = (meals) => {
  const macros = addMacros(meals.map((meal) => meal.totals));
  return {
    macros,
    totals: { ...macros, calories: round(MACRO_CALORIES(macros)) },
  };
};

const correctProteinRounding = (plan, input) => {
  const correctedPlan = { ...plan, amounts: [...plan.amounts] };
  let meals = buildStructuredMeals(correctedPlan, input.mealsPerDay);
  let summary = summarizeMeals(meals);
  const proteinIndex = correctedPlan.foods.reduce((bestIndex, food, index) => {
    const calories = MACRO_CALORIES(food);
    const score = calories > 0 ? food.protein / calories : 0;
    const bestFood = correctedPlan.foods[bestIndex];
    const bestCalories = MACRO_CALORIES(bestFood);
    const bestScore = bestCalories > 0 ? bestFood.protein / bestCalories : 0;
    return score > bestScore ? index : bestIndex;
  }, 0);
  const proteinPerGram = correctedPlan.foods[proteinIndex].protein / 100;

  for (
    let attempt = 0;
    attempt < 3 && summary.totals.protein < input.minimumProteinGrams;
    attempt += 1
  ) {
    if (proteinPerGram <= 0) break;
    const deficit = input.minimumProteinGrams - summary.totals.protein;
    const roundingReserve = input.mealsPerDay * 0.1;
    const extraGrams = Math.max(
      1,
      Math.ceil((deficit + roundingReserve) / proteinPerGram),
    );
    const nextAmount = correctedPlan.amounts[proteinIndex] + extraGrams;
    if (nextAmount > 3000) break;
    correctedPlan.amounts[proteinIndex] = nextAmount;
    meals = buildStructuredMeals(correctedPlan, input.mealsPerDay);
    summary = summarizeMeals(meals);
  }

  return { plan: correctedPlan, meals, ...summary };
};

const describeMeal = (meal) => `### ${meal.label}\n${meal.foods.map((food) =>
  `- ${food.amountGrams}g ${food.name} (${food.macros.protein}g P, ${food.macros.carb}g C, ${food.macros.fat}g F; ${food.calories} kcal)`).join("\n")}`;

const resolvePrice = async (plan, budgetVndPerDay, getPriceMap) => {
  if (budgetVndPerDay == null) return { status: "not_requested" };
  const prices = await getPriceMap(plan.foods.map((food) => food._id));
  const entries = plan.foods.map((food, index) => ({
    price: prices.get(String(food._id)) || prices.get(food._id),
    amount: plan.amounts[index],
  }));
  if (entries.some(({ price }) => price?.coverageStatus !== "sufficient" || !Number.isFinite(price.typicalVndPer100g))) {
    return { status: "unverified", budgetVndPerDay, reason: "insufficient_price_provenance" };
  }
  const estimatedTotalVnd = Math.round(entries.reduce((total, { price, amount }) => total + (price.typicalVndPer100g * amount) / 100, 0));
  return { status: "verified", budgetVndPerDay, estimatedTotalVnd, isWithinBudget: estimatedTotalVnd <= budgetVndPerDay };
};

const normalizedName = (value) => String(value || "").trim().toLocaleLowerCase("vi");

const scopedFollowUp = (input, previousMealPlan, catalog, constraints) => {
  const allowedIds = new Set(input.allowedAdjustmentFoodIds.map(String));
  const allowedNames = new Set(input.allowedAdjustmentFoodNames.map(normalizedName).filter(Boolean));
  const catalogById = new Map(
    catalog.map((food) => [String(food._id), food]),
  );
  const sourceMeals = Array.isArray(previousMealPlan?.meals) ? previousMealPlan.meals : [];
  if (allowedIds.size + allowedNames.size === 0 || sourceMeals.length === 0) return null;
  const meals = sourceMeals.map((meal) => ({
    label: String(meal?.label || ""),
    foods: Array.isArray(meal?.foods) ? meal.foods.map((food) => ({
      foodId: String(food?.foodId || ""),
      name: String(food?.name || ""),
      amountGrams: asFinite(food?.amountGrams),
      macros: {
        protein: asFinite(food?.macros?.protein),
        carb: asFinite(food?.macros?.carb),
        fat: asFinite(food?.macros?.fat),
      },
    })) : [],
  }));
  const items = meals.flatMap((meal) => meal.foods);
  if (items.length === 0 || items.some((food) =>
    !food.foodId || !food.name || !Number.isFinite(food.amountGrams) || food.amountGrams <= 0 ||
    Object.values(food.macros).some((value) => !Number.isFinite(value) || value < 0),
  )) return missingData("scoped_adjustment_invalid_plan", "Không thể chỉnh thực đơn cũ vì dữ liệu kế hoạch có cấu trúc chưa đầy đủ.");
  for (const food of items) {
    const catalogFood = catalogById.get(food.foodId);
    if (!catalogFood) {
      return missingData(
        "scoped_adjustment_catalog_mismatch",
        "Không thể chỉnh thực đơn cũ vì một món không còn trong dữ liệu thực phẩm hiện hành.",
      );
    }
    if (!hasReviewedProfile(catalogFood)) {
      return missingData(
        "scoped_adjustment_safety_metadata_missing",
        "Không thể xác minh lại an toàn thực phẩm cho toàn bộ thực đơn cũ.",
      );
    }
    if (!allowedFood(catalogFood, constraints)) {
      return missingData(
        "scoped_adjustment_safety_conflict",
        "Thực đơn cũ có món không còn phù hợp với ràng buộc dị ứng hoặc loại trừ hiện tại.",
      );
    }
  }
  const validatedMeals = meals.map((meal) => ({
    ...meal,
    foods: meal.foods.map((food) => {
      const catalogFood = catalogById.get(food.foodId);
      return {
        ...food,
        name: catalogFood.label,
        macros: foodMacro(catalogFood, food.amountGrams),
      };
    }),
  }));
  const validatedItems = validatedMeals.flatMap((meal) => meal.foods);
  const isAllowed = (food) => allowedIds.has(food.foodId) || allowedNames.has(normalizedName(food.name));
  const fixedMacros = addMacros(validatedItems.filter((food) => !isAllowed(food)).map((food) => food.macros));
  const adjustableMacros = addMacros(validatedItems.filter(isAllowed).map((food) => food.macros));
  const adjustableCalories = MACRO_CALORIES(adjustableMacros);
  const scale = (input.targetCalories - MACRO_CALORIES(fixedMacros)) / adjustableCalories;
  if (!Number.isFinite(scale) || scale < 0 || adjustableCalories <= 0) {
    return missingData("scoped_adjustment_impossible", "Không thể đạt mục tiêu mới chỉ bằng các món bạn cho phép điều chỉnh.");
  }
  const adjustedMeals = validatedMeals.map((meal) => {
    const foods = meal.foods.map((food) => {
      const macros = isAllowed(food)
        ? Object.fromEntries(Object.entries(food.macros).map(([key, value]) => [key, round(value * scale)]))
        : food.macros;
      return {
        ...food,
        amountGrams: isAllowed(food) ? round(food.amountGrams * scale) : food.amountGrams,
        macros,
        calories: round(MACRO_CALORIES(macros)),
      };
    });
    const macros = addMacros(foods.map((food) => food.macros));
    return { label: meal.label, foods, totals: { ...macros, calories: round(MACRO_CALORIES(macros)) } };
  });
  const adjustments = validatedMeals.flatMap((meal, mealIndex) =>
    meal.foods.flatMap((food, foodIndex) => {
      if (!isAllowed(food)) return [];
      const adjustedFood = adjustedMeals[mealIndex].foods[foodIndex];
      return [{
        mealIndex,
        mealLabel: meal.label,
        foodId: food.foodId,
        name: adjustedFood.name,
        beforeAmountGrams: food.amountGrams,
        afterAmountGrams: adjustedFood.amountGrams,
      }];
    }),
  );
  const adjustmentText = adjustments.length > 0
    ? `## LƯỢNG ĐÃ ĐỔI\n${adjustments.map((adjustment) =>
      `- ${adjustment.mealLabel || `Bữa ${adjustment.mealIndex + 1}`} — ${adjustment.name}: ${adjustment.beforeAmountGrams}g → ${adjustment.afterAmountGrams}g`).join("\n")}\n\n`
    : "";
  const macros = addMacros(adjustedMeals.map((meal) => meal.totals));
  const totals = { ...macros, calories: round(MACRO_CALORIES(macros)) };
  if (Math.abs(totals.calories - input.targetCalories) > input.targetToleranceCalories || totals.protein < input.minimumProteinGrams) {
    return missingData("scoped_adjustment_constraints_not_met", "Không thể giữ các món cố định mà vẫn đáp ứng toàn bộ ràng buộc mới.");
  }
  const price = input.budgetVndPerDay == null
    ? { status: "not_requested" }
    : { status: "unverified", budgetVndPerDay: input.budgetVndPerDay, reason: "scoped_adjustment_price_not_revalidated" };
  return {
    text: `# THỰC ĐƠN ĐÃ ĐIỀU CHỈNH\nMục tiêu ${input.targetCalories} kcal/ngày. Tổng server tính: ${totals.calories} kcal | ${totals.protein}g P | ${totals.carb}g C | ${totals.fat}g F.\n\n${adjustmentText}${adjustedMeals.map(describeMeal).join("\n\n")}${price.status === "unverified" ? " Ngân sách chưa thể xác minh sau khi điều chỉnh." : ""}`,
    uiCard: {
      cardType: "meal",
      data: {
        status: "complete", targetCalories: input.targetCalories, targetToleranceCalories: input.targetToleranceCalories,
        macros, totals, meals: adjustedMeals, adjustments, price,
        safety: buildSafetyEvidence(constraints),
        targets: { proteinGrams: input.proteinGrams, carbGrams: input.carbGrams, fatGrams: input.fatGrams, minimumProteinGrams: input.minimumProteinGrams },
        nutritionMethod: "server_calculated_4p_4c_9f",
      },
    },
  };
};

/**
 * Deterministically creates a meal card whose nutrition is calculated by this server.
 * @param {object} params Tool parameters.
 * @param {{findFoods?: Function, getPriceMap?: Function}} context Testable catalog/price seams.
 */
export async function suggestMeal(params, {
  findFoods = defaultFindFoods,
  getPriceMap = getFoodMarketPriceMap,
  previousMealPlan = null,
} = {}) {
  const input = normalizeParams(params);
  if (!input || (input.budgetVndPerDay !== null && input.budgetVndPerDay < 0)) {
    return missingData("invalid_constraints", "Không thể tạo thực đơn vì các ràng buộc dinh dưỡng chưa hợp lệ.");
  }
  const scopedAdjustmentRequested =
    input.allowedAdjustmentFoodIds.length > 0 ||
    input.allowedAdjustmentFoodNames.length > 0;
  if (
    scopedAdjustmentRequested &&
    !Array.isArray(previousMealPlan?.meals)
  ) {
    return missingData(
      "scoped_adjustment_missing_plan",
      "Không thể chỉnh thực đơn cũ vì chưa có kế hoạch có cấu trúc để đối chiếu.",
    );
  }
  const excludedTerms = input.excludedFoods.map((value) => String(value).trim().toLocaleLowerCase("vi")).filter(Boolean);
  const excludedAllergens = [...new Set([...input.excludedAllergens, ...(input.lactoseFree ? ["milk"] : [])])];
  const requireSafetyMetadata = excludedTerms.length > 0 || excludedAllergens.length > 0;
  let catalog;
  try {
    catalog = (await findFoods()).map(normalizeFood).filter(Boolean);
  } catch {
    return missingData("catalog_unavailable", "Chưa thể xác minh dữ liệu thực phẩm để tạo thực đơn an toàn.");
  }
  const scopedResult = scopedFollowUp(input, previousMealPlan, catalog, {
    excludedTerms,
    excludedAllergens,
    requireSafetyMetadata: true,
  });
  if (scopedResult) return scopedResult;
  const target = targetMacros(input);
  if (!target) return missingData("impossible_constraints", "Mục tiêu kcal và protein hiện không thể đồng thời đáp ứng an toàn. Bạn hãy điều chỉnh mục tiêu.");
  const eligibleFoods = catalog.filter((food) => allowedFood(food, { excludedTerms, excludedAllergens, requireSafetyMetadata }));
  if (eligibleFoods.length < 3) {
    return missingData(requireSafetyMetadata ? "safety_metadata_missing" : "catalog_insufficient", "Chưa đủ dữ liệu thực phẩm đã kiểm duyệt để đáp ứng các ràng buộc an toàn này.");
  }
  const plan = choosePlan(eligibleFoods, target);
  if (!plan) return missingData("catalog_insufficient", "Chưa đủ thực phẩm phù hợp để đáp ứng chính xác mục tiêu dinh dưỡng này.");
  const corrected = correctProteinRounding(plan, input);
  const { meals, macros, totals } = corrected;
  if (Math.abs(totals.calories - input.targetCalories) > input.targetToleranceCalories || totals.protein < input.minimumProteinGrams) {
    return missingData("constraints_not_met", "Dữ liệu thực phẩm hiện không cho phép đáp ứng chính xác các ràng buộc đã nêu.");
  }
  let price;
  try {
    price = await resolvePrice(corrected.plan, input.budgetVndPerDay, getPriceMap);
  } catch {
    price = { status: "unverified", budgetVndPerDay: input.budgetVndPerDay, reason: "price_lookup_unavailable" };
  }
  const priceText = price.status === "unverified"
    ? " Ngân sách chưa thể xác minh vì thiếu nguồn giá hiện hành cho các món đã chọn."
    : price.status === "verified"
      ? ` Chi phí ước tính đã xác minh từ dữ liệu giá: ${price.estimatedTotalVnd.toLocaleString("vi-VN")}đ/ngày${price.isWithinBudget ? ", trong ngân sách." : ", vượt ngân sách."}`
      : "";
  return {
    text: `# THỰC ĐƠN ${input.mealsPerDay} BỮA\nMục tiêu ${input.targetCalories} kcal/ngày. Tổng server tính: ${totals.calories} kcal | ${totals.protein}g P | ${totals.carb}g C | ${totals.fat}g F.\n\n${meals.map(describeMeal).join("\n\n")}${priceText}`,
    uiCard: {
      cardType: "meal",
      data: {
        status: "complete", targetCalories: input.targetCalories, targetToleranceCalories: input.targetToleranceCalories,
        macros, totals, meals, price,
        safety: buildSafetyEvidence({
          requireSafetyMetadata,
          excludedTerms,
          excludedAllergens,
        }),
        targets: { proteinGrams: input.proteinGrams, carbGrams: input.carbGrams, fatGrams: input.fatGrams, minimumProteinGrams: input.minimumProteinGrams },
        nutritionMethod: "server_calculated_4p_4c_9f",
      },
    },
  };
}
