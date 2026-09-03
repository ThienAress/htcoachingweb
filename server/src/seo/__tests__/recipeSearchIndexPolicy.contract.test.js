import { describe, expect, it } from "vitest";

import {
  SEARCH_INDEX_RECIPE_SLUGS as CLIENT_SEARCH_INDEX_RECIPE_SLUGS,
} from "../../../../client/src/seo/searchIndexCohort.js";
import {
  isRecipeSeoEligible as isClientRecipeSeoEligible,
} from "../../../../client/src/seo/recipeSearchIndexPolicy.js";
import {
  isPinnedRecipePostStateEligible,
  isRecipeSeoEligible,
  isSearchIndexRecipeSlug,
  SEARCH_INDEX_RECIPE_SLUGS,
} from "../recipeSearchIndexPolicy.js";

const substantiveStep = (label) =>
  `${label}: prepare every ingredient carefully, follow the safe cooking order, and verify doneness before continuing to the next detailed step.`;

const eligibleRecipe = (overrides = {}) => ({
  slug: SEARCH_INDEX_RECIPE_SLUGS[0],
  name: "Vietnamese Style Veggie Hotpot",
  thumbnail: "https://images.example.test/hotpot.jpg",
  sourceUrl: "https://source.example.test/hotpot",
  ingredients: [
    { name: "Carrot", measure: "100 g" },
    { name: "Tofu", measure: "200 g" },
    { name: "Mushroom", measure: "150 g" },
  ],
  instructions: [
    substantiveStep("Prepare"),
    substantiveStep("Cook"),
    substantiveStep("Finish"),
  ],
  nutrition: {
    scope: "whole_recipe",
    source: "admin_manual",
    calories: 520,
    protein: 42,
    fat: 18,
    carb: 48,
    sugars: 7,
    salt: 1.4,
  },
  isPublished: true,
  ...overrides,
});

describe("server Recipe search-index policy parity", () => {
  it("pins the exact client-owned Recipe cohort", () => {
    expect(SEARCH_INDEX_RECIPE_SLUGS).toEqual(
      CLIENT_SEARCH_INDEX_RECIPE_SLUGS,
    );
  });

  it("matches the client hard eligibility boundary matrix", () => {
    const cases = [
      eligibleRecipe(),
      eligibleRecipe({ slug: "Invalid Slug" }),
      eligibleRecipe({ name: "abc" }),
      eligibleRecipe({ thumbnail: "http://images.example.test/hotpot.jpg" }),
      eligibleRecipe({ sourceUrl: "" }),
      eligibleRecipe({ ingredients: [{ name: "Tofu", measure: "200 g" }] }),
      eligibleRecipe({ instructions: ["Cook briefly"] }),
      eligibleRecipe({ nutrition: null }),
      eligibleRecipe({ nutrition: { ...eligibleRecipe().nutrition, calories: 0 } }),
    ];

    expect(cases.map(isRecipeSeoEligible)).toEqual(
      cases.map(isClientRecipeSeoEligible),
    );
  });

  it("requires a published, eligible post-state for pinned Recipes", () => {
    expect({
      pinned: isSearchIndexRecipeSlug(SEARCH_INDEX_RECIPE_SLUGS[0]),
      eligible: isPinnedRecipePostStateEligible(eligibleRecipe()),
      draft: isPinnedRecipePostStateEligible(
        eligibleRecipe({ isPublished: false }),
      ),
      shallow: isPinnedRecipePostStateEligible(
        eligibleRecipe({ instructions: ["Cook briefly"] }),
      ),
    }).toEqual({ pinned: true, eligible: true, draft: false, shallow: false });
  });
});
