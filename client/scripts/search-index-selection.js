import {
  SEARCH_INDEX_EXERCISE_IDS,
  SEARCH_INDEX_RECIPE_SLUGS,
} from "../src/seo/searchIndexCohort.js";
import { selectExercisesForSeo } from "./exercise-seo-selection.js";
import { selectRecipesForSeo } from "./recipe-seo-selection.js";

export const selectSearchIndexCohort = (
  { recipes = [], exercises = [] } = {},
  { strict = false } = {},
) => ({
  recipes: selectRecipesForSeo(recipes, {
    limit: SEARCH_INDEX_RECIPE_SLUGS.length,
    minimum: SEARCH_INDEX_RECIPE_SLUGS.length,
    strict,
    pinnedSlugs: SEARCH_INDEX_RECIPE_SLUGS,
  }),
  exercises: selectExercisesForSeo(exercises, {
    limit: SEARCH_INDEX_EXERCISE_IDS.length,
    minimum: SEARCH_INDEX_EXERCISE_IDS.length,
    strict,
    pinnedIds: SEARCH_INDEX_EXERCISE_IDS,
  }),
});
