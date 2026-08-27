const id = (value) => (value ? String(value) : null);
const iso = (value) => (value ? new Date(value).toISOString() : null);
const zeroTotals = () => ({ protein: 0, carb: 0, fat: 0, calories: 0 });
const round1 = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 10) / 10;
const sumEatenTotals = (entries = []) =>
  Object.fromEntries(
    Object.keys(zeroTotals()).map((key) => [
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

const toNutritionDto = (nutrition) => ({
  assignment: nutrition?.assignment
    ? {
        savedMealPlanId: id(nutrition.assignment.savedMealPlanId),
        lineageKey: nutrition.assignment.lineageKey,
        version: nutrition.assignment.version,
        titleSnapshot: nutrition.assignment.titleSnapshot,
        assignedAt: iso(nutrition.assignment.assignedAt),
        totalsSnapshot: nutrition.assignment.totalsSnapshot
          ? {
              protein: nutrition.assignment.totalsSnapshot.protein,
              carb: nutrition.assignment.totalsSnapshot.carb,
              fat: nutrition.assignment.totalsSnapshot.fat,
              calories: nutrition.assignment.totalsSnapshot.calories,
            }
          : null,
      }
    : null,
  entries: (nutrition?.entries || []).map((entry) => ({
    entryId: entry.entryId,
    mode: entry.mode,
    status: entry.status,
    plannedMealKey: entry.plannedMealKey || "",
    savedMealPlanId: id(entry.savedMealPlanId),
    version: entry.version ?? null,
    recipeId: id(entry.recipeId),
    recipeSlugSnapshot: entry.recipeSlugSnapshot || "",
    labelSnapshot: entry.labelSnapshot,
    mealName:
      entry.mode === "manual"
        ? entry.mealName || "Bữa ăn phát sinh"
        : "",
    description: entry.description || "",
    note: entry.note || "",
    actualFoods: (entry.actualFoods || []).map((food) => ({
      foodId: id(food.foodId),
      labelSnapshot: food.labelSnapshot,
      plannedAmountGrams: food.plannedAmountGrams,
      actualAmountGrams: food.actualAmountGrams,
      nutrition: {
        protein: food.nutrition?.protein || 0,
        carb: food.nutrition?.carb || 0,
        fat: food.nutrition?.fat || 0,
        calories: food.nutrition?.calories || 0,
      },
    })),
    actualTotals: entry.actualTotals
      ? {
          protein: entry.actualTotals.protein,
          carb: entry.actualTotals.carb,
          fat: entry.actualTotals.fat,
          calories: entry.actualTotals.calories,
        }
      : null,
    editCount: entry.editCount ?? 0,
    recordedAt: iso(entry.recordedAt),
  })),
  dailyTotals: sumEatenTotals(nutrition?.entries || []),
  submittedAt: iso(nutrition?.submittedAt),
});

export const toDailyJournalDto = (
  document,
  { includePrivate = true } = {},
) => {
  if (!document) return null;
  const value =
    typeof document.toObject === "function"
      ? document.toObject()
      : document;
  const wellness = {
    sleepHours: value.wellness?.sleepHours ?? null,
    waterMl: value.wellness?.waterMl ?? null,
    steps: value.wellness?.steps ?? null,
    energy: value.wellness?.energy ?? null,
    hunger: value.wellness?.hunger ?? null,
    stress: value.wellness?.stress ?? null,
    soreness: value.wellness?.soreness ?? null,
    pain: value.wellness?.pain ?? null,
    painArea: value.wellness?.painArea || "",
  };
  const completionFields = Object.entries(wellness).filter(
    ([key]) => key !== "painArea",
  );
  const filled = completionFields.filter(
    ([, fieldValue]) => fieldValue !== null,
  ).length;
  return {
    _id: id(value._id),
    dateKey: value.dateKey,
    timeZone: value.timeZone,
    wellness,
    notes: {
      ...(includePrivate
        ? { private: value.notes?.private || "" }
        : {}),
      shared: value.notes?.shared || "",
    },
    nutrition: toNutritionDto(value.nutrition),
    habitCompletions: (value.habitCompletions || []).map((completion) => ({
      habitId: id(completion.habitId),
      lineageKey: completion.lineageKey,
      version: completion.version,
      titleSnapshot: completion.titleSnapshot,
      status: completion.status,
      recordedAt: iso(completion.recordedAt),
    })),
    status: value.status,
    submittedAt: iso(value.submittedAt),
    revision: value.revision,
    correctionCount: value.correctionCount ?? 0,
    completion: {
      filled,
      total: completionFields.length,
      percent: Math.round((filled / completionFields.length) * 100),
    },
    updatedAt: iso(value.updatedAt),
  };
};

export const toDailyJournalRevisionDto = (document) => {
  const value =
    typeof document.toObject === "function"
      ? document.toObject()
      : document;
  return {
    _id: id(value._id),
    revision: value.revision,
    actorRole: value.actorRole,
    action: value.action,
    changedAt: iso(value.changedAt),
    reason: value.reason || "",
    changes: (value.changes || []).map((change) => ({
      path: change.path,
      before: change.before ?? null,
      after: change.after ?? null,
    })),
  };
};
