import { LOCAL_FOOD_PRICE_OBSERVATIONS } from "../constants/localFoodPriceObservations.js";
import { TECHNICAL_DIFFICULTY_CRITERIA } from "../models/Exercise.js";
import { isBeginnerBodyweightChestExercise } from "../services/ai/exerciseCatalogCompatibility.js";
import { normalizeFoodAllergenProfile } from "../services/foodAllergen.service.js";
import { validatePriceManifest } from "./localFoodPriceImport.contract.js";
import {
  STAGING_AI_CATALOG_EXERCISES,
  STAGING_AI_CATALOG_FOODS,
  stagingAiCatalogError,
} from "./stagingAiCatalogRollout.contract.js";

const REVIEWED_AT = "2026-09-18T00:00:00.000Z";
const ALLERGEN_EVIDENCE_SCOPE = "generic_whole_food_big_9_identity_only";

const isHttpsSource = (value, hostname) => {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" && !url.username && !url.password &&
      url.hostname.toLowerCase() === hostname;
  } catch {
    return false;
  }
};

const dominantMacro = (food) => ["protein", "carb", "fat"]
  .map((key) => [key, Number(food?.[key])])
  .sort((left, right) => right[1] - left[1])[0]?.[0];

const reviewedProfile = ({ identitySourceUrl, specificContains }) =>
  normalizeFoodAllergenProfile({
    reviewStatus: "reviewed",
    contains: [],
    mayContain: [],
    reviewedScopes: specificContains.length ? ["specific_foods"] : [],
    specificContains: [...specificContains],
    sourceType: "official_database",
    sourceUrl: identitySourceUrl,
    reviewedAt: new Date(REVIEWED_AT),
  });

const allergenEvidence = (manifest) => ({
  identitySourceUrl: manifest.identitySourceUrl,
  allergenTaxonomySourceUrl: manifest.allergenTaxonomySourceUrl,
  scope: ALLERGEN_EVIDENCE_SCOPE,
  crossContactStatus: "not_asserted",
});

const normalizeDate = (value) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const sanitizeExercise = (exercise, manifest) => {
  const instructions = exercise?.instructions;
  const validInstructions = Array.isArray(instructions) &&
    instructions.length <= 30 &&
    instructions.every((step) =>
      step && typeof step === "object" && !Array.isArray(step) &&
      typeof step.title === "string" &&
      step.title.trim().length > 0 && step.title.trim().length <= 160 &&
      (step.description == null ||
        (typeof step.description === "string" && step.description.length <= 2000)));
  const difficulty = exercise?.technicalDifficulty;
  const validDifficulty = difficulty == null || (
    difficulty && typeof difficulty === "object" && !Array.isArray(difficulty) &&
    Object.keys(difficulty).every((key) =>
      [...TECHNICAL_DIFFICULTY_CRITERIA, "rationale"].includes(key)) &&
    TECHNICAL_DIFFICULTY_CRITERIA.every((key) =>
      Number.isInteger(difficulty[key]) &&
      difficulty[key] >= 0 && difficulty[key] <= 2) &&
    (difficulty.rationale == null ||
      (typeof difficulty.rationale === "string" && difficulty.rationale.length <= 1000))
  );
  if (
    String(exercise?._id || "") !== manifest.id ||
    exercise?.name !== manifest.name ||
    !isBeginnerBodyweightChestExercise(exercise) ||
    !validInstructions ||
    !validDifficulty
  ) {
    throw stagingAiCatalogError("STAGING_AI_CATALOG_EXERCISE_SOURCE_INVALID");
  }
  return {
    _id: manifest.id,
    name: manifest.name,
    muscleGroup: String(exercise.muscleGroup),
    description: String(exercise.description || ""),
    videoUrl: String(exercise.videoUrl || ""),
    imageUrl: String(exercise.imageUrl || ""),
    instructions: instructions.map(({ title, description }) => ({
      title: title.trim(),
      description: String(description || ""),
    })),
    ...(difficulty ? { technicalDifficulty: structuredClone(difficulty) } : {}),
    ...(normalizeDate(exercise.createdAt)
      ? { createdAt: normalizeDate(exercise.createdAt) }
      : {}),
    ...(normalizeDate(exercise.updatedAt)
      ? { updatedAt: normalizeDate(exercise.updatedAt) }
      : {}),
  };
};

const sanitizeFood = (food, manifest) => {
  const macros = Object.fromEntries(
    ["protein", "carb", "fat", "calories"].map((field) => [
      field,
      Number(food?.[field]),
    ]),
  );
  if (
    food?.label !== manifest.label ||
    Object.values(macros).some((value) => !Number.isFinite(value) || value < 0) ||
    dominantMacro(macros) !== manifest.macroGroup ||
    !isHttpsSource(manifest.identitySourceUrl, "fdc.nal.usda.gov") ||
    !["www.fda.gov", "www.fsis.usda.gov"].some((hostname) =>
      isHttpsSource(manifest.allergenTaxonomySourceUrl, hostname)) ||
    !Array.isArray(manifest.specificContains)
  ) {
    throw stagingAiCatalogError("STAGING_AI_CATALOG_FOOD_SOURCE_INVALID");
  }
  return {
    sourceId: String(food._id || ""),
    label: manifest.label,
    macroGroup: manifest.macroGroup,
    ...macros,
    allergenProfile: reviewedProfile(manifest),
    allergenEvidence: allergenEvidence(manifest),
  };
};

export const validateStagingAiCatalogManifest = () => {
  const prices = LOCAL_FOOD_PRICE_OBSERVATIONS.filter(({ foodLabel }) =>
    STAGING_AI_CATALOG_FOODS.some(({ label }) => label === foodLabel));
  validatePriceManifest(prices);
  if (
    new Set(STAGING_AI_CATALOG_EXERCISES.map(({ id }) => id)).size !== 5 ||
    new Set(STAGING_AI_CATALOG_EXERCISES.map(({ name }) => name)).size !== 5 ||
    new Set(STAGING_AI_CATALOG_FOODS.map(({ label }) => label)).size !== 3 ||
    prices.length !== 3
  ) {
    throw stagingAiCatalogError("STAGING_AI_CATALOG_MANIFEST_INVALID");
  }
  return { exercises: 5, foods: 3, prices: 3 };
};

export const createStagingAiCatalogSource = ({ exercises, foods } = {}) => {
  validateStagingAiCatalogManifest();
  const exerciseById = new Map(
    (exercises || []).map((exercise) => [String(exercise?._id || ""), exercise]),
  );
  const foodByLabel = new Map((foods || []).map((food) => [food?.label, food]));
  return {
    exercises: STAGING_AI_CATALOG_EXERCISES.map((manifest) =>
      sanitizeExercise(exerciseById.get(manifest.id), manifest)),
    foods: STAGING_AI_CATALOG_FOODS.map((manifest) =>
      sanitizeFood(foodByLabel.get(manifest.label), manifest)),
    prices: LOCAL_FOOD_PRICE_OBSERVATIONS
      .filter(({ foodLabel }) => foodByLabel.has(foodLabel))
      .filter(({ foodLabel }) =>
        STAGING_AI_CATALOG_FOODS.some(({ label }) => label === foodLabel))
      .map((observation) => structuredClone(observation)),
  };
};
