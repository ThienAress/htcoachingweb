export const SEARCH_INDEX_RECIPE_SLUGS = Object.freeze([
  "vietnamese-style-veggie-hotpot",
  "vietnamese-veg-parcels",
  "tofu-greens-cashew-stir-fry",
  "tangy-carrot-cabbage-onion-salad",
  "vegan-banh-mi",
  "vietnamese-prawn-spiralized-rolls",
  "vietnamese-caramel-trout",
  "sea-bass-with-sizzled-ginger-chilli-spring-onions",
  "salt-pepper-squid",
  "salmon-noodle-wraps",
]);

export const SEARCH_INDEX_EXERCISES = Object.freeze(
  [
    ["6a4b43515b0a4f47f1108990", "3/4 Sit-up"],
    ["6a4b495ea5de82055378a732", "Assisted Pull-up"],
    ["6a4b4998a5de82055378a7d4", "Band Squat"],
    ["6a4b4991a5de82055378a7c2", "Band Shoulder Press"],
    ["6a4b49aba5de82055378a80a", "Barbell Bench Press"],
    ["6a4b49b4a5de82055378a823", "Barbell Deadlift"],
    ["6a4b4a8ca5de82055378aa6e", "Cable Lat Pulldown Full Range Of Motion"],
    ["69d1362ea0f04831d73b8e0d", "Diamond Push-up"],
    ["6a4b4b44a5de82055378ac72", "Dumbbell Biceps Curl"],
    ["6a4b4b4aa5de82055378ac81", "Dumbbell Burpee"],
  ].map(([id, name]) => Object.freeze({ id, name })),
);

export const SEARCH_INDEX_EXERCISE_IDS = Object.freeze(
  SEARCH_INDEX_EXERCISES.map(({ id }) => id),
);

const recipeSlugSet = new Set(SEARCH_INDEX_RECIPE_SLUGS);
const expectedExerciseNameById = new Map(
  SEARCH_INDEX_EXERCISES.map(({ id, name }) => [id, name]),
);

export const isSearchIndexRecipeSlug = (slug) =>
  recipeSlugSet.has(String(slug || "").trim());

export const isSearchIndexExerciseId = (id) =>
  expectedExerciseNameById.has(String(id || "").trim());

export const isSearchIndexExerciseIdentity = ({ id, name } = {}) => {
  const expectedName = expectedExerciseNameById.get(String(id || "").trim());
  return Boolean(expectedName && name === expectedName);
};
