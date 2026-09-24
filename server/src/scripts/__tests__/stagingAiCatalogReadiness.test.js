import { describe, expect, it } from "vitest";

import {
  evaluateStagingAiCatalogReadiness,
  inspectStagingAiCatalogReadiness,
} from "../stagingAiCatalogReadiness.js";

const reviewedProfile = (contains = []) => ({
  reviewStatus: "reviewed",
  sourceType: "official_database",
  sourceUrl: "https://fdc.nal.usda.gov/food-search/?query=whole%20food",
  reviewedAt: new Date("2026-09-01T00:00:00.000Z"),
  contains,
  mayContain: [],
});

const food = (id, label, macros, allergenProfile = reviewedProfile()) => ({
  _id: id,
  label,
  ...macros,
  allergenProfile,
});

const price = (foodId, observedAt = "2026-09-10T00:00:00.000Z") => ({
  foodId,
  sourceKey: "bach_hoa_xanh",
  sourceUrl: `https://www.bachhoaxanh.com/thit-ga/${foodId}`,
  packGrams: 500,
  regularPriceVnd: 50_000,
  observedAt: new Date(observedAt),
});

const chestExercises = [
  "Push-up",
  "Kneeling Push-up",
  "Wall Push-up",
  "Chest Tap Push-up",
  "Modified Push-up",
].map((name, index) => ({
  _id: `exercise-${index}`,
  name,
  muscleGroup: "Cơ ngực",
  description: "Bài bodyweight push-up không cần dụng cụ dành cho người mới.",
}));

describe("staging AI catalog readiness", () => {
  it("passes only when the Q2 and Q7 catalog dependencies have reviewed provenance", () => {
    const foods = [
      food("protein", "Ức gà", { protein: 22, carb: 0, fat: 2.6 }),
      food("carb", "Cơm trắng", { protein: 2.7, carb: 28, fat: 0.3 }),
      food("fat", "Dầu olive", { protein: 0, carb: 0, fat: 100 }),
    ];

    expect(evaluateStagingAiCatalogReadiness({
      exercises: chestExercises,
      foods,
      priceObservations: foods.map(({ _id }) => price(_id)),
      now: new Date("2026-09-18T00:00:00.000Z"),
    })).toMatchObject({
      ready: true,
      gaps: [],
      metrics: {
        beginnerBodyweightChest: 5,
        safeMealFoods: 3,
        ingredientVerifiedSafeMealFoods: 3,
        crossContactVerifiedSafeMealFoods: 0,
        freshPricedSafeMealFoods: 3,
        safeMacroGroups: ["carb", "fat", "protein"],
      },
    });
  });

  it("reports displaced fixtures, thin exercise coverage and unreviewed food data", () => {
    const result = evaluateStagingAiCatalogReadiness({
      exercises: [
        chestExercises[0],
        {
          _id: "displaced",
          name: "__plan079_displaced__id__Push-up",
          muscleGroup: "Cơ ngực",
          _stagingSearchIndexCohortDisplaced: { managed: true },
        },
      ],
      foods: [
        food(
          "unsafe",
          "Bơ đậu phộng",
          { protein: 25, carb: 20, fat: 50 },
          { reviewStatus: "unreviewed" },
        ),
      ],
      priceObservations: [price("unsafe", "2026-01-01T00:00:00.000Z")],
      now: new Date("2026-09-18T00:00:00.000Z"),
    });

    expect(result.ready).toBe(false);
    expect(result.gaps).toEqual([
      "exercise_displaced_fixture_present",
      "exercise_beginner_bodyweight_chest_insufficient",
      "food_reviewed_allergen_coverage_insufficient",
      "food_safe_macro_groups_incomplete",
      "food_fresh_price_coverage_insufficient",
      "food_fresh_price_macro_groups_incomplete",
    ]);
  });

  it("does not count chest exercises that require bench, chair, band, bar or TRX setup", () => {
    const incompatible = [
      ["Incline Push-up", "Đặt tay trên ghế bench."],
      ["Chair Dip", "Dùng ghế chắc chắn."],
      ["Band Push-up", "Quấn dây kháng lực sau lưng."],
      ["Bar Dip", "Thực hiện trên xà kép."],
      ["TRX Push-up", "Dùng suspension trainer."],
    ].map(([name, description], index) => ({
      _id: `setup-${index}`,
      name,
      muscleGroup: "Cơ ngực",
      description,
    }));

    const result = evaluateStagingAiCatalogReadiness({
      exercises: [...chestExercises.slice(0, 1), ...incompatible],
    });

    expect(result.metrics.beginnerBodyweightChest).toBe(1);
    expect(result.gaps).toContain(
      "exercise_beginner_bodyweight_chest_insufficient",
    );
  });

  it("does not count legacy string instructions unsupported by the Exercise runtime schema", () => {
    const result = evaluateStagingAiCatalogReadiness({
      exercises: [{
        name: "Wall Press Legacy",
        muscleGroup: "Cơ ngực",
        instructions: ["Bodyweight setup không cần dụng cụ."],
      }],
    });

    expect(result.metrics.beginnerBodyweightChest).toBe(0);
    expect(result.gaps).toContain(
      "exercise_beginner_bodyweight_chest_insufficient",
    );
  });

  it("does not count peanut or milk foods toward the hard-constraint meal cohort", () => {
    const foods = [
      food("peanut", "Bơ đậu phộng", { protein: 25, carb: 20, fat: 50 }, reviewedProfile(["peanut"])),
      food("milk", "Sữa tươi", { protein: 3, carb: 5, fat: 3 }, reviewedProfile(["milk"])),
      food("chicken", "Ức gà", { protein: 22, carb: 0, fat: 2.6 }),
    ];

    const result = evaluateStagingAiCatalogReadiness({
      exercises: chestExercises,
      foods,
      priceObservations: foods.map(({ _id }) => price(_id)),
      now: new Date("2026-09-18T00:00:00.000Z"),
    });

    expect(result.metrics.safeMealFoods).toBe(1);
    expect(result.metrics.freshPricedSafeMealFoods).toBe(1);
  });

  it("requires fresh price provenance for every safe macro group", () => {
    const foods = [
      food("protein-1", "Ức gà", { protein: 22, carb: 0, fat: 2.6 }),
      food("protein-2", "Cá ngừ", { protein: 25, carb: 0, fat: 1 }),
      food("protein-3", "Lòng trắng trứng", { protein: 11, carb: 1, fat: 0 }),
      food("carb", "Cơm trắng", { protein: 2.7, carb: 28, fat: 0.3 }),
      food("fat", "Dầu olive", { protein: 0, carb: 0, fat: 100 }),
    ];

    const result = evaluateStagingAiCatalogReadiness({
      exercises: chestExercises,
      foods,
      priceObservations: foods
        .filter(({ _id }) => String(_id).startsWith("protein"))
        .map(({ _id }) => price(_id)),
      now: new Date("2026-09-18T00:00:00.000Z"),
    });

    expect(result.ready).toBe(false);
    expect(result.gaps).toContain("food_fresh_price_macro_groups_incomplete");
    expect(result.metrics.freshPricedSafeMacroGroups).toEqual(["protein"]);
  });

  it("rejects a fresh numeric price whose URL is outside the retailer allowlist", () => {
    const foods = [
      food("protein", "Ức gà", { protein: 22, carb: 0, fat: 2.6 }),
      food("carb", "Cơm trắng", { protein: 2.7, carb: 28, fat: 0.3 }),
      food("fat", "Dầu olive", { protein: 0, carb: 0, fat: 100 }),
    ];
    const observations = foods.map(({ _id }) => price(_id));
    observations[1].sourceUrl = "https://example.test/untrusted-price";

    const result = evaluateStagingAiCatalogReadiness({
      exercises: chestExercises,
      foods,
      priceObservations: observations,
      now: new Date("2026-09-18T00:00:00.000Z"),
    });

    expect(result.ready).toBe(false);
    expect(result.gaps).toContain("food_fresh_price_macro_groups_incomplete");
    expect(result.metrics.freshPricedSafeMacroGroups).toEqual(["fat", "protein"]);
  });

  it.each([
    ["unsupported source type", { sourceType: "blog" }],
    ["non-HTTPS source", { sourceUrl: "http://fdc.nal.usda.gov/food/1" }],
    ["untrusted host", { sourceUrl: "https://example.test/food/1" }],
    ["future review date", { reviewedAt: new Date("2026-09-19T00:00:00.000Z") }],
  ])("rejects %s allergen provenance", (_label, override) => {
    const foods = [
      food("protein", "Ức gà", { protein: 22, carb: 0, fat: 2.6 }, {
        ...reviewedProfile(),
        ...override,
      }),
      food("carb", "Cơm trắng", { protein: 2.7, carb: 28, fat: 0.3 }),
      food("fat", "Dầu olive", { protein: 0, carb: 0, fat: 100 }),
    ];

    const result = evaluateStagingAiCatalogReadiness({
      exercises: chestExercises,
      foods,
      priceObservations: foods.map(({ _id }) => price(_id)),
      now: new Date("2026-09-18T00:00:00.000Z"),
    });

    expect(result.ready).toBe(false);
    expect(result.metrics.safeMealFoods).toBe(2);
  });

  it("reads only projected catalog fields and a bounded fresh price window", async () => {
    const foods = [
      food("protein", "Ức gà", { protein: 22, carb: 0, fat: 2.6 }),
      food("carb", "Cơm trắng", { protein: 2.7, carb: 28, fat: 0.3 }),
      food("fat", "Dầu olive", { protein: 0, carb: 0, fat: 100 }),
    ];
    const rows = {
      exercises: chestExercises,
      foods,
      foodpriceobservations: foods.map(({ _id }) => price(_id)),
    };
    const calls = [];
    const db = {
      collection: (name) => ({
        find: (filter, options) => {
          calls.push({ name, filter, options });
          return { toArray: async () => rows[name] };
        },
      }),
    };

    const result = await inspectStagingAiCatalogReadiness({
      db,
      now: new Date("2026-09-18T00:00:00.000Z"),
    });

    expect(result.ready).toBe(true);
    expect(calls.map(({ name }) => name)).toEqual([
      "exercises",
      "foods",
      "foodpriceobservations",
    ]);
    expect(calls[2].filter.observedAt).toEqual({
      $gte: new Date("2026-06-20T00:00:00.000Z"),
      $lte: new Date("2026-09-18T00:00:00.000Z"),
    });
    expect(calls.every(({ options }) => options.projection)).toBe(true);
  });
});
