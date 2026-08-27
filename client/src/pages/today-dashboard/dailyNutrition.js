const commandEntry = (entry) => {
  const common = {
    entryId: entry.entryId,
    mode: entry.mode,
    status: entry.status,
    note: entry.note || "",
  };
  if (entry.mode === "follow_plan") {
    const sourceAdjustments =
      entry.adjustments ||
      (entry.actualFoods || []).map((food) => ({
        foodId: food.foodId,
        amountGrams: food.actualAmountGrams,
      }));
    return {
      ...common,
      plannedMealKey: entry.plannedMealKey,
      ...(sourceAdjustments.length > 0
        ? {
            adjustments: sourceAdjustments.map((item) => ({
              foodId: item.foodId,
              amountGrams: Number(item.amountGrams),
            })),
          }
        : {}),
    };
  }
  if (entry.mode === "recipe") {
    return { ...common, recipeId: entry.recipeId };
  }
  return {
    ...common,
    mealName: entry.mealName || "Bữa ăn phát sinh",
    description: entry.description,
  };
};

export const toNutritionCommandEntries = (entries = []) =>
  entries.map(commandEntry);

export const upsertPlannedMealEntry = (
  entries,
  { mealKey, status, entryId },
) => {
  const next = toNutritionCommandEntries(entries);
  const index = next.findIndex(
    (entry) =>
      entry.mode === "follow_plan" && entry.plannedMealKey === mealKey,
  );
  if (index < 0 && next.length >= 10) {
    throw new Error("Mỗi ngày có tối đa 10 mục bữa ăn");
  }
  const value = {
    entryId: index >= 0 ? next[index].entryId : entryId,
    mode: "follow_plan",
    plannedMealKey: mealKey,
    status,
    note: index >= 0 ? next[index].note : "",
    ...(index >= 0 && next[index].adjustments
      ? { adjustments: next[index].adjustments }
      : {}),
  };
  if (index >= 0) next[index] = value;
  else next.push(value);
  return next;
};

export const createManualMealEntry = ({
  entryId,
  mealName,
  foodDescription,
}) => ({
  entryId,
  mode: "manual",
  mealName: mealName.trim(),
  description: foodDescription.trim(),
  status: "eaten",
  note: "",
});

export const updateManualMealEntry = (
  entries,
  { entryId, mealName, foodDescription },
) => {
  const entry = entries.find((item) => item.entryId === entryId);
  if (!entry || entry.mode !== "manual") {
    throw new Error("Không tìm thấy bữa ăn phát sinh cần cập nhật");
  }
  if (Number(entry.editCount || 0) >= 1) {
    throw new Error("Bữa ăn phát sinh chỉ được cập nhật một lần");
  }
  return toNutritionCommandEntries(entries).map((item) =>
    item.entryId === entryId
      ? {
          ...item,
          mealName: mealName.trim(),
          description: foodDescription.trim(),
        }
      : item,
  );
};

export const updatePlannedMealAdjustments = (
  entries,
  { mealKey, adjustments, entryId },
) => {
  const next = toNutritionCommandEntries(entries);
  const index = next.findIndex(
    (entry) =>
      entry.mode === "follow_plan" && entry.plannedMealKey === mealKey,
  );
  if (index < 0 && next.length >= 10) {
    throw new Error("Mỗi ngày có tối đa 10 mục bữa ăn");
  }
  if (!Array.isArray(adjustments) || adjustments.length < 1) {
    throw new Error("Hãy nhập khối lượng thực tế của bữa ăn");
  }
  const value = {
    entryId: index >= 0 ? next[index].entryId : entryId,
    mode: "follow_plan",
    plannedMealKey: mealKey,
    status: index >= 0 && next[index].status === "eaten" ? "eaten" : "changed",
    note: index >= 0 ? next[index].note : "",
    adjustments: adjustments.map((item) => ({
      foodId: item.foodId,
      amountGrams: Number(item.amountGrams),
    })),
  };
  if (index >= 0) next[index] = value;
  else next.push(value);
  return next;
};

const NUTRITION_KEYS = ["calories", "protein", "carb", "fat"];
const round1 = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 10) / 10;

export const dailyNutritionTotals = (entries = []) =>
  Object.fromEntries(
    NUTRITION_KEYS.map((key) => [
      key,
      round1(
        entries
          .filter((entry) => entry.status === "eaten")
          .reduce(
            (total, entry) => total + Number(entry.actualTotals?.[key] || 0),
            0,
          ),
      ),
    ]),
  );

export const nutritionComparison = (entries = [], target = {}) => {
  const actual = dailyNutritionTotals(entries);
  return NUTRITION_KEYS.map((key) => {
    const targetValue = round1(target?.[key]);
    const delta = round1(actual[key] - targetValue);
    return {
      key,
      actual: actual[key],
      target: targetValue,
      state: Math.abs(delta) < 0.1 ? "met" : delta > 0 ? "over" : "remaining",
      difference: round1(Math.abs(delta)),
    };
  });
};

export const createRecipeMealEntry = ({ entryId, recipeId }) => ({
  entryId,
  mode: "recipe",
  recipeId,
  status: "eaten",
  note: "",
});

export const appendNutritionEntry = (entries, entry) => {
  if (entries.length >= 10) {
    throw new Error("Mỗi ngày có tối đa 10 mục bữa ăn");
  }
  return [...toNutritionCommandEntries(entries), entry];
};
