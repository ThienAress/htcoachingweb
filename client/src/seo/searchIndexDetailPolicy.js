import { isCanonicalExerciseDetailSlug } from "../pages/ExercisesPage/exerciseDetailPath.js";
import {
  isSearchIndexExerciseIdentity,
  isSearchIndexRecipeSlug,
} from "./searchIndexCohort.js";
import { isExerciseSeoEligible } from "./exerciseSearchIndexPolicy.js";
import { isRecipeSeoEligible } from "./recipeSearchIndexPolicy.js";

export const isIndexableRecipeDetail = ({ routeSlug, recipe }) =>
  Boolean(
    recipe &&
      String(routeSlug || "") === String(recipe.slug || "") &&
      isSearchIndexRecipeSlug(recipe.slug) &&
      isRecipeSeoEligible(recipe),
  );

export const isIndexableExerciseDetail = ({ routeSlug, exercise }) =>
  Boolean(
    exercise &&
      isSearchIndexExerciseIdentity({
        id: exercise._id,
        name: exercise.name,
      }) &&
      isCanonicalExerciseDetailSlug(exercise, routeSlug) &&
      isExerciseSeoEligible(exercise),
  );
