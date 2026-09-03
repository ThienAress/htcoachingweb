import { describe, expect, it } from "vitest";

import {
  SEARCH_INDEX_EXERCISE_IDS,
  SEARCH_INDEX_RECIPE_SLUGS,
} from "../../src/seo/searchIndexCohort.js";
import { selectSearchIndexCohort } from "../search-index-selection.js";

const recipe = (slug) => ({
  slug,
  name: `Recipe ${slug}`,
  thumbnail: "https://images.example.com/recipe.jpg",
  sourceUrl: "https://source.example.com/recipe",
  ingredients: [
    { name: "Ingredient one", measure: "1 cup" },
    { name: "Ingredient two", measure: "2 tbsp" },
    { name: "Ingredient three", measure: "1 tsp" },
  ],
  instructions: ["A".repeat(160), "B".repeat(160)],
  nutrition: {
    status: "available",
    source: "admin_manual",
    scope: "whole_recipe",
    values: {
      calories: 500,
      protein: 30,
      fat: 20,
      carb: 60,
      sugars: 10,
      salt: 2,
    },
  },
});

const exercise = (id) => ({
  _id: id,
  name: `Exercise ${id.slice(-4)}`,
  muscleGroup: "Toàn thân",
  description: `Giữ thân người ổn định trong suốt chuyển động, kiểm soát nhịp thở và biên độ, đồng thời dừng lại nếu tư thế không còn an toàn hoặc xuất hiện cảm giác đau bất thường. Mã nội dung riêng của bài tập là ${id}.`,
  imageUrl: "https://images.example.com/exercise.gif",
  instructions: ["Chuẩn bị", "Thực hiện", "Kết thúc"].map((title) => ({
    title,
    description:
      "Giữ tư thế chắc chắn, kiểm tra vị trí bàn chân, cột sống và nhịp thở trước khi chuyển sang bước tiếp theo một cách có kiểm soát.",
  })),
  technicalDifficulty: {
    coordination: 1,
    stability: 1,
    mobility: 1,
    setup: 1,
    errorConsequence: 1,
  },
});

describe("search index cohort selection", () => {
  it("returns exactly the repo-owned cohort in editorial order", () => {
    const result = selectSearchIndexCohort(
      {
        recipes: [
          recipe("unapproved-recipe"),
          ...[...SEARCH_INDEX_RECIPE_SLUGS].reverse().map(recipe),
        ],
        exercises: [
          exercise("64b000000000000000000099"),
          ...[...SEARCH_INDEX_EXERCISE_IDS].reverse().map(exercise),
        ],
      },
      { strict: true },
    );

    expect(result.recipes.map(({ slug }) => slug)).toEqual(
      SEARCH_INDEX_RECIPE_SLUGS,
    );
    expect(result.exercises.map(({ _id }) => _id)).toEqual(
      SEARCH_INDEX_EXERCISE_IDS,
    );
  });

  it("fails closed when a pinned release item is absent", () => {
    expect(() =>
      selectSearchIndexCohort(
        {
          recipes: SEARCH_INDEX_RECIPE_SLUGS.slice(1).map(recipe),
          exercises: SEARCH_INDEX_EXERCISE_IDS.map(exercise),
        },
        { strict: true },
      ),
    ).toThrow(/requires at least 10 quality candidates/i);
  });
});
