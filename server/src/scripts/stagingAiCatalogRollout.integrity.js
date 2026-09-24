import { LOCAL_FOOD_PRICE_OBSERVATIONS } from "../constants/localFoodPriceObservations.js";
import {
  STAGING_AI_CATALOG_EXERCISES,
  STAGING_AI_CATALOG_FOODS,
  STAGING_AI_CATALOG_ROLLOUT_KEY,
  STAGING_AI_CATALOG_ROLLOUT_VERSION,
  hashStagingAiCatalogPayload,
  stagingAiCatalogError,
} from "./stagingAiCatalogRollout.contract.js";

export const clone = (value) =>
  value === undefined ? undefined : structuredClone(value);

export const id = (value) => String(value || "");

const SHA256_PATTERN = /^[a-f0-9]{64}$/;

const exercisePayload = (exercise) => ({
  _id: id(exercise?._id),
  name: exercise?.name,
  muscleGroup: exercise?.muscleGroup,
  description: exercise?.description || "",
  videoUrl: exercise?.videoUrl || "",
  imageUrl: exercise?.imageUrl || "",
  instructions: exercise?.instructions || [],
  ...(exercise?.technicalDifficulty
    ? { technicalDifficulty: exercise.technicalDifficulty }
    : {}),
  ...(exercise?.createdAt ? { createdAt: new Date(exercise.createdAt) } : {}),
  ...(exercise?.updatedAt ? { updatedAt: new Date(exercise.updatedAt) } : {}),
});

export const pricePayload = (observation) => ({
  foodId: id(observation?.foodId),
  sourceKey: observation?.sourceKey,
  region: observation?.region || "ho_chi_minh",
  currency: observation?.currency || "VND",
  packGrams: observation?.packGrams,
  regularPriceVnd: observation?.regularPriceVnd,
  promotionalPriceVnd: observation?.promotionalPriceVnd ?? null,
  sourceUrl: observation?.sourceUrl,
  observedAt: new Date(observation?.observedAt),
});

export const profileHash = (food) =>
  hashStagingAiCatalogPayload(food?.allergenProfile || null);

const foodStatePayload = (food) => ({
  _id: id(food?._id),
  label: food?.label,
  protein: food?.protein,
  carb: food?.carb,
  fat: food?.fat,
  calories: food?.calories,
  allergenProfile: food?.allergenProfile || null,
  testCatalogFixture: food?._testCatalogFixture || null,
});

export const foodStateHash = (food) =>
  hashStagingAiCatalogPayload(foodStatePayload(food));

export const exerciseHash = (exercise) =>
  hashStagingAiCatalogPayload(exercisePayload(exercise));

export const priceHash = (observation) =>
  hashStagingAiCatalogPayload(pricePayload(observation));

export const markerHash = (ownedMarker) =>
  hashStagingAiCatalogPayload(ownedMarker);

export const priceIdentity = (observation) => {
  const observedAt = new Date(observation?.observedAt);
  return `${id(observation?.foodId)}|${String(observation?.sourceKey || "")}|${
    Number.isNaN(observedAt.getTime()) ? "invalid" : observedAt.toISOString()
  }`;
};

export const isOwned = (document, kind) => {
  const ownedMarker = document?._stagingAiCatalogRollout;
  return ownedMarker?.managed === true &&
    ownedMarker?.key === STAGING_AI_CATALOG_ROLLOUT_KEY &&
    ownedMarker?.version === STAGING_AI_CATALOG_ROLLOUT_VERSION &&
    ownedMarker?.kind === kind;
};

const hasExactKeys = (value, expected) =>
  value && typeof value === "object" && !Array.isArray(value) &&
  Object.keys(value).sort().join("|") === [...expected].sort().join("|");

const hasValidMarkerIntegrity = (document, kind, expectedSourceKey) => {
  const owned = document?._stagingAiCatalogRollout;
  if (!isOwned(document, kind)) return false;
  const expectedKeys = [
    "managed", "key", "version", "kind", "sourceKey", "sourceHash",
    "appliedHash", "priorState", "priorStateHash", "syncedAt",
    ...(kind === "food" ? ["evidence", "evidenceHash"] : []),
  ];
  const syncedAt = new Date(owned.syncedAt);
  const priorKeys = kind === "food"
    ? ["mode", "allergenProfile"]
    : ["mode"];
  if (
    !hasExactKeys(owned, expectedKeys) ||
    owned.sourceKey !== expectedSourceKey ||
    !SHA256_PATTERN.test(String(owned.sourceHash || "")) ||
    owned.sourceHash !== owned.appliedHash ||
    !hasExactKeys(owned.priorState, priorKeys) ||
    owned.priorState.mode !== (kind === "food" ? "updated" : "inserted") ||
    owned.priorStateHash !== hashStagingAiCatalogPayload(owned.priorState) ||
    Number.isNaN(syncedAt.getTime())
  ) return false;
  if (kind === "food") {
    return SHA256_PATTERN.test(String(owned.evidenceHash || "")) &&
      owned.evidenceHash === hashStagingAiCatalogPayload(owned.evidence);
  }
  return true;
};

export const marker = ({
  kind,
  sourceKey,
  sourceHash,
  priorState,
  evidence,
  now,
}) => {
  const ownedEvidence = clone(evidence);
  const ownedPriorState = clone(priorState);
  return {
    managed: true,
    key: STAGING_AI_CATALOG_ROLLOUT_KEY,
    version: STAGING_AI_CATALOG_ROLLOUT_VERSION,
    kind,
    sourceKey,
    sourceHash,
    appliedHash: sourceHash,
    priorState: ownedPriorState,
    priorStateHash: hashStagingAiCatalogPayload(ownedPriorState),
    ...(ownedEvidence
      ? {
          evidence: ownedEvidence,
          evidenceHash: hashStagingAiCatalogPayload(ownedEvidence),
        }
      : {}),
    syncedAt: new Date(now),
  };
};

export const assertNoForeignOwnedRows = (target) => {
  const exerciseIds = new Set(STAGING_AI_CATALOG_EXERCISES.map(({ id: value }) => value));
  const foodLabels = new Set(STAGING_AI_CATALOG_FOODS.map(({ label }) => label));
  const foodIdsByLabel = new Map(
    (target.foods || []).map((food) => [food.label, id(food._id)]),
  );
  const priceIdentities = new Set(
    LOCAL_FOOD_PRICE_OBSERVATIONS
      .filter(({ foodLabel }) => foodLabels.has(foodLabel))
      .map((observation) => priceIdentity({
        ...observation,
        foodId: foodIdsByLabel.get(observation.foodLabel),
      })),
  );
  if ((target.exercises || []).some((row) =>
    row?._stagingAiCatalogRollout &&
    (!exerciseIds.has(id(row._id)) ||
      !hasValidMarkerIntegrity(row, "exercise", id(row._id)) ||
      exerciseHash(row) !== row._stagingAiCatalogRollout.appliedHash))) {
    throw stagingAiCatalogError("STAGING_AI_CATALOG_EXERCISE_MARKER_DRIFT");
  }
  if ((target.foods || []).some((row) =>
    row?._stagingAiCatalogRollout &&
    (!foodLabels.has(row.label) ||
      !hasValidMarkerIntegrity(row, "food", row.label) ||
      profileHash(row) !== row._stagingAiCatalogRollout.appliedHash))) {
    throw stagingAiCatalogError("STAGING_AI_CATALOG_FOOD_MARKER_DRIFT");
  }
  if ((target.priceObservations || []).some((row) =>
    row?._stagingAiCatalogRollout &&
    (!priceIdentities.has(priceIdentity(row)) ||
      !hasValidMarkerIntegrity(row, "price", priceIdentity(row)) ||
      priceHash(row) !== row._stagingAiCatalogRollout.appliedHash))) {
    throw stagingAiCatalogError("STAGING_AI_CATALOG_PRICE_MARKER_DRIFT");
  }
};

export const stagingAiCatalogHashes = Object.freeze({
  exercise: exerciseHash,
  foodProfile: profileHash,
  foodState: foodStateHash,
  price: priceHash,
});
