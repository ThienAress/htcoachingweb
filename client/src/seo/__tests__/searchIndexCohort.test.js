import { describe, expect, test } from "vitest";

import {
  SEARCH_INDEX_EXERCISE_IDS,
  SEARCH_INDEX_EXERCISES,
  SEARCH_INDEX_RECIPE_SLUGS,
  isSearchIndexExerciseId,
  isSearchIndexRecipeSlug,
} from "../searchIndexCohort.js";

describe("searchIndexCohort", () => {
  test("pins exactly ten unique recipes and ten unique exercises", () => {
    expect(SEARCH_INDEX_RECIPE_SLUGS).toHaveLength(10);
    expect(new Set(SEARCH_INDEX_RECIPE_SLUGS).size).toBe(10);
    expect(SEARCH_INDEX_EXERCISE_IDS).toHaveLength(10);
    expect(new Set(SEARCH_INDEX_EXERCISE_IDS).size).toBe(10);
    expect(SEARCH_INDEX_EXERCISES.map(({ id }) => id)).toEqual(
      SEARCH_INDEX_EXERCISE_IDS,
    );
  });

  test("keeps canonical identities valid and exposes exact membership", () => {
    expect(
      SEARCH_INDEX_RECIPE_SLUGS.every((slug) =>
        /^[a-z0-9][a-z0-9-]*$/.test(slug),
      ),
    ).toBe(true);
    expect(
      SEARCH_INDEX_EXERCISE_IDS.every((id) => /^[a-f0-9]{24}$/i.test(id)),
    ).toBe(true);

    expect(isSearchIndexRecipeSlug(SEARCH_INDEX_RECIPE_SLUGS[0])).toBe(true);
    expect(isSearchIndexRecipeSlug("not-in-cohort")).toBe(false);
    expect(isSearchIndexExerciseId(SEARCH_INDEX_EXERCISE_IDS[0])).toBe(true);
    expect(isSearchIndexExerciseId("000000000000000000000000")).toBe(false);
  });
});
