import { describe, expect, it } from "vitest";

import { selectRecipesForSeo } from "../recipe-seo-selection.js";

const substantiveStep = (label) =>
  `${label}: sơ chế nguyên liệu cẩn thận, thực hiện đúng thứ tự và kiểm tra độ chín trước khi chuyển sang bước tiếp theo để món ăn an toàn, thơm ngon.`;

const publicNutrition = {
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
  additional: [{ label: "Chất xơ", unit: "g", value: 8.5 }],
};

const rawNutrition = {
  source: "admin_manual",
  scope: "whole_recipe",
  calories: 520,
  protein: 42,
  fat: 18,
  carb: 48,
  sugars: 7,
  salt: 1.4,
  additional: [{ label: "Chất xơ", unit: "g", value: 8.5 }],
};

const recipe = (slug, overrides = {}) => ({
  slug,
  name: "Món ăn chất lượng " + slug,
  thumbnail: "https://images.example.com/" + slug + ".jpg",
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
  source: "mealdb",
  sourceUrl: "https://example.com/source/" + slug,
  nutrition: publicNutrition,
  ...overrides,
});

describe("recipe SEO selection", () => {
  it("keeps an explicitly pinned cohort in the caller-provided order", () => {
    const selected = selectRecipesForSeo(
      [recipe("alpha"), recipe("bravo"), recipe("charlie")],
      {
        pinnedSlugs: ["charlie", "alpha"],
        limit: 2,
        minimum: 2,
        strict: true,
      },
    );

    expect(selected.map((item) => item.slug)).toEqual(["charlie", "alpha"]);
  });

  it("accepts complete nutrition in both public and raw API shapes", () => {
    const selected = selectRecipesForSeo(
      [
        recipe("public-shape"),
        recipe("raw-shape", { nutrition: rawNutrition }),
      ],
      { pinnedSlugs: ["raw-shape", "public-shape"], limit: 2 },
    );

    expect(selected.map((item) => item.slug)).toEqual([
      "raw-shape",
      "public-shape",
    ]);
  });

  it("rejects recipes without provenance, deep instructions, or complete nutrition", () => {
    const selected = selectRecipesForSeo([
      recipe("complete"),
      recipe("missing-source", { sourceUrl: "" }),
      recipe("thin-content", { instructions: ["Nấu chín", "Trình bày"] }),
      recipe("missing-nutrition", {
        nutrition: { ...publicNutrition, status: "unavailable" },
      }),
    ]);

    expect(selected.map((item) => item.slug)).toEqual(["complete"]);
  });

  it("does not use area, AI source, or updatedAt as ranking shortcuts", () => {
    const selected = selectRecipesForSeo([
      recipe("zulu", {
        area: "Việt Nam",
        source: "ai",
        updatedAt: "2099-01-01T00:00:00.000Z",
      }),
      recipe("alpha", {
        area: "Không xác định",
        source: "mealdb",
        updatedAt: "2020-01-01T00:00:00.000Z",
      }),
    ]);

    expect(selected.map((item) => item.slug)).toEqual(["alpha", "zulu"]);
  });

  it("rejects duplicate pinned slugs instead of silently changing the cohort", () => {
    expect(() =>
      selectRecipesForSeo([recipe("duplicate")], {
        pinnedSlugs: ["duplicate", "duplicate"],
      }),
    ).toThrow(/duplicate pinned recipe slug/i);
  });

  it("fails a strict release when too few recipes pass the quality gate", () => {
    expect(() =>
      selectRecipesForSeo([recipe("only-one")], {
        pinnedSlugs: ["only-one", "missing"],
        minimum: 2,
        strict: true,
      }),
    ).toThrow(/at least 2 quality candidates/i);
  });
});
