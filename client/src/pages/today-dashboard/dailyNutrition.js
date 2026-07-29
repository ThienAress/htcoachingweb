const commandEntry = (entry) => {
  const common = {
    entryId: entry.entryId,
    mode: entry.mode,
    status: entry.status,
    note: entry.note || "",
  };
  if (entry.mode === "follow_plan") {
    return { ...common, plannedMealKey: entry.plannedMealKey };
  }
  if (entry.mode === "recipe") {
    return { ...common, recipeId: entry.recipeId };
  }
  return { ...common, description: entry.description };
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
    throw new Error("A day can contain at most 10 meal entries");
  }
  const value = {
    entryId: index >= 0 ? next[index].entryId : entryId,
    mode: "follow_plan",
    plannedMealKey: mealKey,
    status,
    note: index >= 0 ? next[index].note : "",
  };
  if (index >= 0) next[index] = value;
  else next.push(value);
  return next;
};

export const createManualMealEntry = ({ entryId, description }) => ({
  entryId,
  mode: "manual",
  description: description.trim(),
  status: "eaten",
  note: "",
});

export const createRecipeMealEntry = ({ entryId, recipeId }) => ({
  entryId,
  mode: "recipe",
  recipeId,
  status: "eaten",
  note: "",
});

export const appendNutritionEntry = (entries, entry) => {
  if (entries.length >= 10) {
    throw new Error("A day can contain at most 10 meal entries");
  }
  return [...toNutritionCommandEntries(entries), entry];
};
