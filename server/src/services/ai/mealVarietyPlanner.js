import { groupMealFoods } from "./mealFoodGroups.js";

// Realistic portion bounds (grams) for one food inside one meal.
const PORTION_BOUNDS = Object.freeze({
  protein: [40, 400],
  starch: [40, 500],
  fat: [3, 60],
});
const CANDIDATES_PER_GROUP = 6;

const seededRandom = (seed) => {
  let state = (Number(seed) >>> 0) || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

const shuffled = (items, random) => {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
};

const portionPenalty = (group, amount) => {
  const [low, high] = PORTION_BOUNDS[group];
  const middle = (low + high) / 2;
  return Math.abs(amount - middle) / (high - low);
};

/**
 * Builds a day plan where every meal has its own starch + protein + fat food
 * and foods are not repeated across meals while the catalog allows it.
 * Returns null when the catalog cannot support it so callers can fall back.
 */
export const buildVarietyPlan = ({
  foods,
  target,
  requiredFoods = [],
  mealsPerDay,
  seed,
  math,
}) => {
  const requiredIds = new Set(requiredFoods.map((food) => String(food._id)));
  const groups = groupMealFoods(foods.filter((food) => !requiredIds.has(String(food._id))));
  if (Object.values(groups).some((list) => list.length < 2)) return null;
  const requiredAmounts = requiredFoods.map(() => mealsPerDay * math.requiredMinPerMeal);
  const requiredMacros = math.addMacros(requiredFoods.map((food, index) =>
    math.foodMacro(food, requiredAmounts[index])));
  const residual = {
    protein: target.protein - requiredMacros.protein,
    carb: target.carb - requiredMacros.carb,
    fat: target.fat - requiredMacros.fat,
  };
  if (Object.values(residual).some((value) => value <= 0 || !Number.isFinite(value))) return null;
  const perMeal = [residual.protein, residual.carb, residual.fat].map((value) => value / mealsPerDay);
  const random = seededRandom(seed);
  const used = new Map();
  const planFoods = [...requiredFoods];
  const planAmounts = [...requiredAmounts];
  const mealIndexes = requiredFoods.map(() => null);
  for (let mealIndex = 0; mealIndex < mealsPerDay; mealIndex += 1) {
    const pools = ["protein", "starch", "fat"].map((group) =>
      shuffled(groups[group], random)
        .sort((left, right) =>
          (used.get(String(left._id)) || 0) - (used.get(String(right._id)) || 0))
        .slice(0, CANDIDATES_PER_GROUP));
    let best = null;
    for (const proteinFood of pools[0]) for (const starchFood of pools[1]) for (const fatFood of pools[2]) {
      const picked = [proteinFood, starchFood, fatFood];
      const amounts = math.solve3x3([
        picked.map((food) => food.protein / 100),
        picked.map((food) => food.carb / 100),
        picked.map((food) => food.fat / 100),
      ], perMeal);
      if (!amounts) continue;
      const groupNames = ["protein", "starch", "fat"];
      const inBounds = amounts.every((amount, index) =>
        Number.isFinite(amount) &&
        amount >= PORTION_BOUNDS[groupNames[index]][0] &&
        amount <= PORTION_BOUNDS[groupNames[index]][1]);
      if (!inBounds) continue;
      const repeats = picked.reduce((total, food) => total + (used.get(String(food._id)) || 0), 0);
      const score = repeats * 100 +
        amounts.reduce((total, amount, index) => total + portionPenalty(groupNames[index], amount), 0) +
        random() * 0.5;
      if (!best || score < best.score) best = { picked, amounts, score };
    }
    if (!best) return null;
    best.picked.forEach((food, index) => {
      planFoods.push(food);
      planAmounts.push(Math.round(best.amounts[index]));
      mealIndexes.push(mealIndex);
      used.set(String(food._id), (used.get(String(food._id)) || 0) + 1);
    });
  }
  return { foods: planFoods, amounts: planAmounts, mealIndexes };
};
