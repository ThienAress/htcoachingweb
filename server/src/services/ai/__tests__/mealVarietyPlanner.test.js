import { describe, expect, it } from "vitest";

import { classifyMealFood } from "../mealFoodGroups.js";
import { suggestMeal } from "../tools/suggestMeal.tool.js";

const food = (id, label, protein, carb, fat) => ({ _id: id, label, protein, carb, fat });

const catalog = [
  food("c1", "Cơm trắng", 2.7, 28, 0.3),
  food("c2", "Phở bò (bánh phở)", 3.2, 24, 0.5),
  food("c3", "Bún tươi", 1.7, 25, 0.1),
  food("c4", "Miến dong", 0.1, 82, 0.1),
  food("c5", "Khoai lang", 1.6, 20, 0.1),
  food("p1", "Ức gà", 23, 0, 1.2),
  food("p2", "Thịt bò nạc", 21, 0, 4),
  food("p3", "Cá basa", 17, 0, 3),
  food("p4", "Trứng gà", 13, 1, 11),
  food("p5", "Tôm sú", 18, 1, 1),
  food("p6", "Mực ống", 15, 2, 1),
  food("f1", "Dầu ô liu", 0, 0, 100),
  food("f2", "Hạt điều", 18, 30, 44),
  food("f3", "Hạnh nhân", 21, 20, 50),
  food("f4", "Quả bơ", 2, 8, 15),
  food("x1", "Mật ong", 0.4, 82, 0),
  food("x2", "Bơ thực vật", 0.1, 0, 81),
  food("x3", "Whey protein", 80, 8, 5),
  food("x4", "Tôm khô", 75, 2.5, 3.7),
];

const request = (variationSeed) => ({
  targetCalories: 2000,
  proteinGrams: 130,
  carbGrams: 220,
  fatGrams: 60,
  mealsPerDay: 3,
  variationSeed,
});

describe("sample menu food groups", () => {
  it("accepts staples and rejects sweeteners, margarine, supplements and dried foods", () => {
    expect(catalog.filter((item) => classifyMealFood(item)).map((item) => item._id)).toEqual(
      expect.arrayContaining(["c1", "c2", "p1", "p5", "f1", "f2", "f4"]),
    );
    for (const id of ["x1", "x2", "x3", "x4"]) {
      expect(classifyMealFood(catalog.find((item) => item._id === id))).toBeNull();
    }
  });

  it("treats butter-like fat as avocado only when it is low fat", () => {
    expect(classifyMealFood(food("a", "Bơ", 2, 8, 15))).toBe("fat");
    expect(classifyMealFood(food("b", "Bơ", 0.5, 0, 80))).toBeNull();
  });
});

describe("suggestMeal variety", () => {
  const run = (seed) => suggestMeal(request(seed), { findFoods: async () => catalog });

  it("never uses sweeteners, margarine or supplements in a sample menu", async () => {
    const result = await run(7);
    const names = result.uiCard.data.meals.flatMap((meal) => meal.foods.map((item) => item.name));
    expect(names.length).toBeGreaterThanOrEqual(9);
    for (const banned of ["Mật ong", "Bơ thực vật", "Whey protein", "Tôm khô"]) {
      expect(names).not.toContain(banned);
    }
  });

  it("gives every meal a starch, a protein and a fat without repeating foods across meals", async () => {
    const result = await run(11);
    const meals = result.uiCard.data.meals;
    expect(meals).toHaveLength(3);
    for (const meal of meals) expect(meal.foods).toHaveLength(3);
    const ids = meals.flatMap((meal) => meal.foods.map((item) => item.foodId));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps the calorie and protein target", async () => {
    const result = await run(23);
    const { totals } = result.uiCard.data;
    expect(Math.abs(totals.calories - 2000)).toBeLessThanOrEqual(100);
    expect(totals.protein).toBeGreaterThanOrEqual(130);
  });

  it("varies the suggestion between requests and is reproducible for one seed", async () => {
    const signature = async (seed) =>
      (await run(seed)).uiCard.data.meals
        .map((meal) => meal.foods.map((item) => item.foodId).join("+"))
        .join("|");
    const signatures = new Set();
    for (const seed of [1, 2, 3, 4, 5, 6]) signatures.add(await signature(seed));
    expect(signatures.size).toBeGreaterThan(2);
    expect(await signature(3)).toBe(await signature(3));
  });

  it("falls back to the legacy solver when the catalog has no usable groups", async () => {
    const sparse = [
      food("a", "Alpha", 20, 5, 2),
      food("b", "Beta", 2, 70, 1),
      food("c", "Gamma", 1, 2, 80),
    ];
    const result = await suggestMeal(
      { targetCalories: 1800, proteinGrams: 100, carbGrams: 200, fatGrams: 50, mealsPerDay: 3 },
      { findFoods: async () => sparse },
    );
    expect(result.uiCard?.data?.meals?.length ?? 0).toBeGreaterThan(0);
  });
});
