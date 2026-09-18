import {
  PLAN_043_FIXTURE_KEY,
  hashStagingAiCatalogPayload,
  stagingAiCatalogError,
} from "./stagingAiCatalogRollout.contract.js";
import {
  assertNoForeignOwnedRows,
  clone,
  exerciseHash,
  foodStateHash,
  id,
  isOwned,
  marker,
  markerHash,
  priceHash,
  priceIdentity,
  pricePayload,
  profileHash,
} from "./stagingAiCatalogRollout.integrity.js";
const indexUnique = (rows, key, code) => {
  const result = new Map();
  for (const row of rows || []) {
    const value = String(row?.[key] || "");
    if (!value || result.has(value)) throw stagingAiCatalogError(code);
    result.set(value, row);
  }
  return result;
};
const dominantMacro = (food) => ["protein", "carb", "fat"]
  .map((key) => [key, Number(food?.[key])])
  .filter(([, value]) => Number.isFinite(value) && value >= 0)
  .sort((left, right) => right[1] - left[1])[0]?.[0];
const emptySummary = () => ({
  insertExercise: 0,
  updateFood: 0,
  insertPrice: 0,
  deleteExercise: 0,
  restoreFood: 0,
  deletePrice: 0,
  unchanged: 0,
});
const planExercises = ({ source, target, operations, summary, now }) => {
  const byId = indexUnique(target.exercises, "_id", "STAGING_AI_CATALOG_EXERCISE_ID_DUPLICATE");
  const byName = indexUnique(target.exercises, "name", "STAGING_AI_CATALOG_EXERCISE_NAME_DUPLICATE");
  for (const exercise of source.exercises) {
    const desiredHash = exerciseHash(exercise);
    const exact = byId.get(id(exercise._id));
    const sameName = byName.get(exercise.name);
    if (sameName && id(sameName._id) !== id(exercise._id)) {
      throw stagingAiCatalogError("STAGING_AI_CATALOG_EXERCISE_NAME_COLLISION");
    }
    if (exact) {
      if (exact.name !== exercise.name) {
        throw stagingAiCatalogError("STAGING_AI_CATALOG_EXERCISE_ID_COLLISION");
      }
      if (!isOwned(exact, "exercise")) {
        throw stagingAiCatalogError("STAGING_AI_CATALOG_EXERCISE_OWNERSHIP_CONFLICT");
      }
      const currentHash = exerciseHash(exact);
      if (currentHash !== desiredHash) {
        throw stagingAiCatalogError("STAGING_AI_CATALOG_EXERCISE_CONTENT_DRIFT");
      }
      if (exact._stagingAiCatalogRollout.appliedHash !== desiredHash) {
        throw stagingAiCatalogError("STAGING_AI_CATALOG_EXERCISE_MARKER_DRIFT");
      }
      summary.unchanged += 1;
      continue;
    }
    const ownedMarker = marker({
      kind: "exercise",
      sourceKey: id(exercise._id),
      sourceHash: desiredHash,
      priorState: { mode: "inserted" },
      now,
    });
    operations.push({
      type: "insert_exercise",
      id: id(exercise._id),
      document: { ...clone(exercise), _stagingAiCatalogRollout: ownedMarker },
    });
    summary.insertExercise += 1;
  }
};
const planFoods = ({ source, target, operations, summary, now }) => {
  const byLabel = indexUnique(target.foods, "label", "STAGING_AI_CATALOG_FOOD_LABEL_DUPLICATE");
  for (const desired of source.foods) {
    const current = byLabel.get(desired.label);
    if (!current) throw stagingAiCatalogError("STAGING_AI_CATALOG_FOOD_MISSING");
    if (dominantMacro(current) !== desired.macroGroup) {
      throw stagingAiCatalogError("STAGING_AI_CATALOG_FOOD_MACRO_DRIFT");
    }
    const desiredHash = profileHash(desired);
    const desiredEvidenceHash = hashStagingAiCatalogPayload(
      desired.allergenEvidence,
    );
    const currentHash = profileHash(current);
    if (currentHash === desiredHash) {
      if (!isOwned(current, "food")) {
        throw stagingAiCatalogError("STAGING_AI_CATALOG_FOOD_OWNERSHIP_CONFLICT");
      }
      const managed = current._stagingAiCatalogRollout;
      if (
        managed.evidenceHash !== desiredEvidenceHash ||
        hashStagingAiCatalogPayload(managed.evidence) !== desiredEvidenceHash
      ) {
        throw stagingAiCatalogError("STAGING_AI_CATALOG_FOOD_MARKER_DRIFT");
      }
      summary.unchanged += 1;
      continue;
    }
    if (isOwned(current, "food")) {
      throw stagingAiCatalogError("STAGING_AI_CATALOG_FOOD_CONTENT_DRIFT");
    }
    if (
      current?._testCatalogFixture?.managed !== true ||
      current?._testCatalogFixture?.key !== PLAN_043_FIXTURE_KEY ||
      current?.allergenProfile?.reviewStatus !== "unreviewed"
    ) {
      throw stagingAiCatalogError("STAGING_AI_CATALOG_FOOD_OWNERSHIP_CONFLICT");
    }
    operations.push({
      type: "update_food",
      id: id(current._id),
      expectedStateHash: foodStateHash(current),
      expectedProfileHash: currentHash,
      allergenProfile: clone(desired.allergenProfile),
      marker: marker({
        kind: "food",
        sourceKey: desired.label,
        sourceHash: desiredHash,
        evidence: desired.allergenEvidence,
        priorState: {
          mode: "updated",
          allergenProfile: clone(current.allergenProfile),
        },
        now,
      }),
    });
    summary.updateFood += 1;
  }
};
const planPrices = ({ source, target, operations, summary, now }) => {
  const foodIds = new Map((target.foods || []).map((food) => [food.label, id(food._id)]));
  const byIdentity = new Map();
  for (const observation of target.priceObservations || []) {
    const key = `${id(observation.foodId)}|${observation.sourceKey}|${new Date(observation.observedAt).toISOString()}`;
    if (byIdentity.has(key)) {
      throw stagingAiCatalogError("STAGING_AI_CATALOG_PRICE_IDENTITY_DUPLICATE");
    }
    byIdentity.set(key, observation);
  }
  for (const sourcePrice of source.prices) {
    const observedAt = new Date(sourcePrice.observedAt);
    if (Number.isNaN(observedAt.getTime()) || observedAt > now ||
      observedAt < new Date(now.getTime() - 90 * 86_400_000)) {
      throw stagingAiCatalogError("STAGING_AI_CATALOG_PRICE_SOURCE_STALE");
    }
    const foodId = foodIds.get(sourcePrice.foodLabel);
    if (!foodId) throw stagingAiCatalogError("STAGING_AI_CATALOG_PRICE_FOOD_MISSING");
    const desired = pricePayload({ ...sourcePrice, foodId });
    const desiredHash = priceHash(desired);
    const key = `${foodId}|${desired.sourceKey}|${desired.observedAt.toISOString()}`;
    const current = byIdentity.get(key);
    if (current) {
      if (priceHash(current) !== desiredHash) {
        throw stagingAiCatalogError("STAGING_AI_CATALOG_PRICE_CONTENT_DRIFT");
      }
      if (!isOwned(current, "price")) {
        throw stagingAiCatalogError("STAGING_AI_CATALOG_PRICE_OWNERSHIP_CONFLICT");
      }
      summary.unchanged += 1;
      continue;
    }
    operations.push({
      type: "insert_price",
      document: {
        ...desired,
        _stagingAiCatalogRollout: marker({
          kind: "price",
          sourceKey: priceIdentity(desired),
          sourceHash: desiredHash,
          priorState: { mode: "inserted" },
          now,
        }),
      },
    });
    summary.insertPrice += 1;
  }
};
const buildSync = ({ source, target, now }) => {
  if (!source) throw stagingAiCatalogError("STAGING_AI_CATALOG_SOURCE_REQUIRED");
  assertNoForeignOwnedRows(target);
  const operations = [];
  const summary = emptySummary();
  planExercises({ source, target, operations, summary, now });
  planFoods({ source, target, operations, summary, now });
  planPrices({ source, target, operations, summary, now });
  return { operation: "sync", operations, summary };
};
const buildRollback = ({ target }) => {
  assertNoForeignOwnedRows(target);
  const operations = [];
  const summary = emptySummary();
  for (const exercise of (target.exercises || []).filter((row) => isOwned(row, "exercise"))) {
    const managed = exercise._stagingAiCatalogRollout;
    if (managed.priorState?.mode !== "inserted" ||
      exerciseHash(exercise) !== managed.appliedHash ||
      Number(target.exerciseReviewCounts?.[id(exercise._id)] || 0) > 0) {
      throw stagingAiCatalogError("STAGING_AI_CATALOG_EXERCISE_ROLLBACK_DRIFT");
    }
    operations.push({
      type: "delete_exercise",
      id: id(exercise._id),
      expectedHash: managed.appliedHash,
      expectedMarkerHash: markerHash(managed),
    });
    summary.deleteExercise += 1;
  }
  for (const food of (target.foods || []).filter((row) => isOwned(row, "food"))) {
    const managed = food._stagingAiCatalogRollout;
    if (
      managed.priorState?.mode !== "updated" ||
      profileHash(food) !== managed.appliedHash ||
      !managed.evidenceHash ||
      hashStagingAiCatalogPayload(managed.evidence) !== managed.evidenceHash
    ) {
      throw stagingAiCatalogError("STAGING_AI_CATALOG_FOOD_ROLLBACK_DRIFT");
    }
    operations.push({
      type: "restore_food",
      id: id(food._id),
      expectedProfileHash: managed.appliedHash,
      expectedMarkerHash: markerHash(managed),
      allergenProfile: clone(managed.priorState.allergenProfile),
    });
    summary.restoreFood += 1;
  }
  for (const price of (target.priceObservations || []).filter((row) => isOwned(row, "price"))) {
    const managed = price._stagingAiCatalogRollout;
    if (managed.priorState?.mode !== "inserted" || priceHash(price) !== managed.appliedHash) {
      throw stagingAiCatalogError("STAGING_AI_CATALOG_PRICE_ROLLBACK_DRIFT");
    }
    operations.push({
      type: "delete_price",
      id: id(price._id),
      expectedHash: managed.appliedHash,
      expectedMarkerHash: markerHash(managed),
    });
    summary.deletePrice += 1;
  }
  return { operation: "rollback", operations, summary };
};
export const buildStagingAiCatalogPlan = ({
  operation, source, target = {}, now = new Date(),
} = {}) => {
  if (operation === "sync") return buildSync({ source, target, now });
  if (operation === "rollback") return buildRollback({ target });
  throw stagingAiCatalogError("STAGING_AI_CATALOG_OPERATION_INVALID");
};
