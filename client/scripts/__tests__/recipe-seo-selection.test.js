import { describe, expect, it } from "vitest";

import { selectRecipesForSeo } from "../recipe-seo-selection.js";

const recipe = (slug, overrides = {}) => ({
  slug,
  name: "Món ăn chất lượng " + slug,
  thumbnail: "https://images.example.com/" + slug + ".jpg",
  ingredients: [{ name: "AA" }, { name: "BB" }, { name: "CC" }],
  instructions: ["Chuẩn bị nguyên liệu", "Nấu chín và trình bày"],
  source: "mealdb",
  ...overrides,
});

describe("recipe SEO selection", () => {
  it("selects a bounded quality set and prioritizes Vietnamese reviewed sources", () => {
    const selected = selectRecipesForSeo(
      [
        recipe("generic"),
        recipe("vietnamese", {
          area: "Việt Nam",
          source: "manual",
          sourceUrl: "https://example.com/source",
        }),
        recipe("missing-content", { instructions: [] }),
      ],
      { limit: 2 },
    );

    expect(selected.map((item) => item.slug)).toEqual([
      "vietnamese",
      "generic",
    ]);
  });

  it("fails a strict release when too few recipes pass the quality gate", () => {
    expect(() =>
      selectRecipesForSeo([recipe("only-one")], {
        minimum: 20,
        strict: true,
      }),
    ).toThrow(/at least 20 quality candidates/i);
  });
});
