const cardData = (output, cardType) =>
  (Array.isArray(output?.cards) ? output.cards : [])
    .find((card) => (card?.cardType || card?.type) === cardType)?.data;

const numeric = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const macroCalories = (data) =>
  4 * Number(data?.protein || 0) +
  4 * Number(data?.carb || 0) +
  9 * Number(data?.fat || 0);

export function evaluateSemanticOutput({ output, rules }) {
  const failures = [];
  for (const rule of rules || []) {
    if (rule.type === "meal_numeric") {
      const meal = cardData(output, "meal");
      const totals = meal?.totals;
      if (meal?.status !== "complete" || !Array.isArray(meal.meals)) {
        failures.push("complete structured meal card is missing");
        continue;
      }
      const calories = numeric(totals?.calories);
      const target = numeric(rule.targetCalories);
      if (calories === null || target === null || Math.abs(calories - target) > rule.toleranceCalories) {
        failures.push("meal calories are outside target tolerance");
      }
      if (numeric(totals?.protein) < rule.minimumProteinGrams) {
        failures.push("meal protein is below minimum");
      }
      if (Math.abs(calories - macroCalories(totals)) > 2) {
        failures.push("meal calories do not match 4P + 4C + 9F");
      }
    } else if (rule.type === "no_flat_exercise_card") {
      if (cardData(output, "exercise")) failures.push("workout output emitted flat exercise card");
    } else if (rule.type === "workout_equipment") {
      const text = String(output?.text || "").toLowerCase();
      for (const forbidden of rule.forbiddenTerms || []) {
        if (text.includes(String(forbidden).toLowerCase())) failures.push(`forbidden equipment: ${forbidden}`);
      }
    } else {
      failures.push(`unknown semantic rule: ${rule.type}`);
    }
  }
  return failures;
}
