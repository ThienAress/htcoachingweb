import { describe, expect, it } from "vitest";

import {
  SEARCH_INDEX_EXERCISES,
  SEARCH_INDEX_RECIPE_SLUGS,
} from "../searchIndexCohort.js";
import {
  isIndexableExerciseDetail,
  isIndexableRecipeDetail,
} from "../searchIndexDetailPolicy.js";

const substantiveStep = (label) =>
  `${label}: sơ chế nguyên liệu cẩn thận, thực hiện đúng thứ tự và kiểm tra độ chín trước khi chuyển sang bước tiếp theo để món ăn an toàn, thơm ngon.`;

const eligibleRecipe = (slug, overrides = {}) => ({
  slug,
  name: "Món ăn chất lượng đã kiểm duyệt",
  thumbnail: "https://images.example.test/recipe.jpg",
  sourceUrl: "https://source.example.test/recipe",
  ingredients: [
    { name: "Nguyên liệu A", measure: "100 g" },
    { name: "Nguyên liệu B", measure: "2 muỗng" },
    { name: "Nguyên liệu C", measure: "1 phần" },
  ],
  instructions: [
    substantiveStep("Chuẩn bị"),
    substantiveStep("Chế biến"),
    substantiveStep("Hoàn thiện"),
  ],
  nutrition: {
    status: "available",
    source: "admin_manual",
    scope: "whole_recipe",
    values: {
      calories: 520,
      protein: 42,
      fat: 18,
      carb: 48,
      sugars: 7,
      salt: 1.4,
    },
  },
  ...overrides,
});

const exerciseDescription = Array.from(
  { length: 20 },
  (_, index) => `quality${index}`,
).join(" ");
const exerciseStep = (position) => ({
  title: `Bước ${position}`,
  description: `${position}`.repeat(80),
});
const eligibleExercise = (approved, overrides = {}) => ({
  _id: approved.id,
  name: approved.name,
  muscleGroup: "Core",
  description: exerciseDescription,
  imageUrl: "https://images.example.test/exercise.jpg",
  instructions: [exerciseStep(1), exerciseStep(2), exerciseStep(3)],
  technicalDifficulty: {
    coordination: 1,
    stability: 1,
    mobility: 1,
    setup: 1,
    errorConsequence: 1,
  },
  ...overrides,
});

describe("search index detail runtime policy", () => {
  it("indexes only an approved Recipe at its exact canonical slug", () => {
    const slug = SEARCH_INDEX_RECIPE_SLUGS[0];
    const recipe = eligibleRecipe(slug);
    expect(isIndexableRecipeDetail({ routeSlug: slug, recipe })).toBe(true);
    expect(
      isIndexableRecipeDetail({ routeSlug: "slug-cu", recipe }),
    ).toBe(false);
    expect(
      isIndexableRecipeDetail({
        routeSlug: "unapproved-recipe",
        recipe: { slug: "unapproved-recipe" },
      }),
    ).toBe(false);
    expect(isIndexableRecipeDetail({ routeSlug: slug, recipe: undefined })).toBe(
      false,
    );
  });

  it("quarantines an approved Recipe when its live content loses eligibility", () => {
    const slug = SEARCH_INDEX_RECIPE_SLUGS[0];

    expect(
      isIndexableRecipeDetail({
        routeSlug: slug,
        recipe: eligibleRecipe(slug, { instructions: ["Nấu chín"] }),
      }),
    ).toBe(false);
  });

  it("indexes only an approved Exercise at its exact canonical slug", () => {
    const approved = SEARCH_INDEX_EXERCISES[0];
    const exercise = eligibleExercise(approved);
    expect(
      isIndexableExerciseDetail({ routeSlug: "3-4-sit-up", exercise }),
    ).toBe(true);
    expect(
      isIndexableExerciseDetail({ routeSlug: "slug-cu", exercise }),
    ).toBe(false);
    expect(
      isIndexableExerciseDetail({
        routeSlug: "unapproved",
        exercise: {
          _id: "64b000000000000000000099",
          name: "Unapproved",
        },
      }),
    ).toBe(false);
    expect(
      isIndexableExerciseDetail({ routeSlug: "3-4-sit-up", exercise: null }),
    ).toBe(false);
  });

  it("quarantines an approved Exercise when live quality regresses", () => {
    const approved = SEARCH_INDEX_EXERCISES[0];
    const cases = [
      { description: "Mô tả ngắn" },
      { imageUrl: "" },
      { instructions: [exerciseStep(1), exerciseStep(2)] },
      { technicalDifficulty: { coordination: 1 } },
    ];

    expect(
      cases.map((overrides) =>
        isIndexableExerciseDetail({
          routeSlug: "3-4-sit-up",
          exercise: eligibleExercise(approved, overrides),
        }),
      ),
    ).toEqual([false, false, false, false]);
  });

  it("quarantines an approved Exercise when its live name drifts", () => {
    const approved = SEARCH_INDEX_EXERCISES[0];
    const exercise = eligibleExercise(approved, {
      name: "Renamed Approved Exercise",
    });

    expect(
      isIndexableExerciseDetail({
        routeSlug: "renamed-approved-exercise",
        exercise,
      }),
    ).toBe(false);
  });
});
