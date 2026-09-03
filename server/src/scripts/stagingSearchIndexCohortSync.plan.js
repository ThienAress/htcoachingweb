import { EXERCISE_MANIFEST } from "../constants/publicTestCatalog.js";
import {
  PLAN_043_FIXTURE_KEY,
  STAGING_SEARCH_COHORT_FIXTURE_KEY,
  STAGING_SEARCH_COHORT_FIXTURE_VERSION,
  STAGING_SEARCH_INDEX_EXERCISES,
  assertUniqueSearchCohortDescriptions,
  exercisePayloadHash,
  sanitizeSearchCohortExercise,
  stagingSearchCohortError,
} from "./stagingSearchIndexCohortSync.contract.js";

const PLAN_043_EXERCISE_NAMES = new Set(
  EXERCISE_MANIFEST.map(({ name }) => name),
);
const expectedDisplacements = new Map(
  STAGING_SEARCH_INDEX_EXERCISES.filter(({ name }) =>
    PLAN_043_EXERCISE_NAMES.has(name),
  ).map(({ id, name }) => [id, name]),
);
const clone = (value) => value === undefined ? undefined : structuredClone(value);

const displacementCandidates = (targetExercises) =>
  (targetExercises || []).filter(
    (exercise) =>
      exercise?._stagingSearchIndexCohortDisplaced ||
      String(exercise?.name || "").startsWith("__plan079_displaced__"),
  );
const assertExpectedDisplacements = (displaced, code) => {
  if (displaced.length !== expectedDisplacements.size) {
    throw stagingSearchCohortError(code);
  }
  const replacementIds = new Set();
  for (const exercise of displaced) {
    const marker = exercise?._stagingSearchIndexCohortDisplaced;
    const replacementId = String(marker?.replacementId || "");
    if (
      marker?.managed !== true ||
      marker?.key !== STAGING_SEARCH_COHORT_FIXTURE_KEY ||
      marker?.version !== STAGING_SEARCH_COHORT_FIXTURE_VERSION ||
      String(exercise?.name || "") !== marker.displacedName ||
      expectedDisplacements.get(replacementId) !== marker.originalName ||
      marker.originalTestCatalogFixture?.managed !== true ||
      marker.originalTestCatalogFixture?.key !== PLAN_043_FIXTURE_KEY ||
      replacementIds.has(replacementId)
    ) {
      throw stagingSearchCohortError(code);
    }
    replacementIds.add(replacementId);
  }
};

const countSummary = (operations, unchanged = 0) => ({
  displace: operations.filter(({ type }) => type === "displace").length,
  insert: operations.filter(({ type }) => type === "insert").length,
  update: operations.filter(({ type }) => type === "update").length,
  delete: operations.filter(({ type }) => type === "delete").length,
  restore: operations.filter(({ type }) => type === "restore").length,
  unchanged,
});

const validateSource = (sourceExercises) => {
  const sanitized = (sourceExercises || []).map(sanitizeSearchCohortExercise);
  assertUniqueSearchCohortDescriptions(sanitized);
  const byId = new Map(sanitized.map((item) => [item._id, item]));
  if (
    sanitized.length !== STAGING_SEARCH_INDEX_EXERCISES.length ||
    byId.size !== STAGING_SEARCH_INDEX_EXERCISES.length ||
    STAGING_SEARCH_INDEX_EXERCISES.some(({ id }) => !byId.has(id))
  ) {
    throw stagingSearchCohortError("STAGING_SEARCH_COHORT_SOURCE_INCOMPLETE");
  }
  return STAGING_SEARCH_INDEX_EXERCISES.map(({ id }) => byId.get(id));
};

const indexTarget = (targetExercises) => {
  const byId = new Map();
  const byName = new Map();
  for (const exercise of targetExercises || []) {
    const id = String(exercise?._id || "");
    const name = String(exercise?.name || "");
    if (!id || byId.has(id)) {
      throw stagingSearchCohortError(
        "STAGING_SEARCH_COHORT_TARGET_ID_DUPLICATE",
      );
    }
    if (name && byName.has(name)) {
      throw stagingSearchCohortError(
        "STAGING_SEARCH_COHORT_TARGET_NAME_DUPLICATE",
      );
    }
    byId.set(id, exercise);
    if (name) byName.set(name, exercise);
  }
  return { byId, byName };
};

const fixtureMarker = ({ exercise, sourceHash, now }) => ({
  managed: true,
  key: STAGING_SEARCH_COHORT_FIXTURE_KEY,
  version: STAGING_SEARCH_COHORT_FIXTURE_VERSION,
  sourceId: exercise._id,
  sourceHash,
  syncedAt: new Date(now),
});

const planOwnedTarget = ({ exact, exercise, sourceHash, now }) => {
  const marker = exact._stagingSearchIndexCohortFixture;
  if (
    marker?.managed !== true ||
    marker?.key !== STAGING_SEARCH_COHORT_FIXTURE_KEY
  ) {
    throw stagingSearchCohortError(
      "STAGING_SEARCH_COHORT_TARGET_ID_OCCUPIED",
    );
  }
  if (exact._testCatalogFixture) {
    throw stagingSearchCohortError(
      "STAGING_SEARCH_COHORT_TARGET_OWNERSHIP_CONFLICT",
    );
  }
  const currentHash = exercisePayloadHash(exact);
  if (currentHash !== marker.sourceHash && currentHash !== sourceHash) {
    throw stagingSearchCohortError(
      "STAGING_SEARCH_COHORT_TARGET_CONTENT_DRIFT",
    );
  }
  if (marker.sourceHash === sourceHash && currentHash === sourceHash) {
    return null;
  }
  return {
    type: "update",
    id: exercise._id,
    expectedSourceHash: marker.sourceHash,
    document: {
      ...exercise,
      _stagingSearchIndexCohortFixture: fixtureMarker({
        exercise,
        sourceHash,
        now,
      }),
    },
  };
};

const planSync = ({ sourceExercises, targetExercises, now }) => {
  const source = validateSource(sourceExercises);
  const { byId, byName } = indexTarget(targetExercises);
  const operations = [];
  let unchanged = 0;
  for (const exercise of source) {
    const sourceHash = exercisePayloadHash(exercise);
    const exact = byId.get(exercise._id);
    const collision = byName.get(exercise.name);
    if (exact) {
      if (collision && String(collision._id) !== exercise._id) {
        throw stagingSearchCohortError("STAGING_SEARCH_COHORT_NAME_COLLISION");
      }
      const update = planOwnedTarget({ exact, exercise, sourceHash, now });
      if (update) operations.push(update);
      else unchanged += 1;
      continue;
    }

    let originalTestCatalogFixture;
    if (collision) {
      const fixture = collision._testCatalogFixture;
      if (
        fixture?.managed !== true ||
        fixture?.key !== PLAN_043_FIXTURE_KEY ||
        !PLAN_043_EXERCISE_NAMES.has(exercise.name) ||
        collision._stagingSearchIndexCohortDisplaced
      ) {
        throw stagingSearchCohortError("STAGING_SEARCH_COHORT_NAME_COLLISION");
      }
      const collisionId = String(collision._id);
      const displacedName = `__plan079_displaced__${collisionId}__${exercise.name}`;
      if (byName.has(displacedName)) {
        throw stagingSearchCohortError(
          "STAGING_SEARCH_COHORT_DISPLACED_NAME_COLLISION",
        );
      }
      originalTestCatalogFixture = clone(fixture);
      operations.push({
        type: "displace",
        id: collisionId,
        expectedName: exercise.name,
        displacedName,
        marker: {
          managed: true,
          key: STAGING_SEARCH_COHORT_FIXTURE_KEY,
          version: STAGING_SEARCH_COHORT_FIXTURE_VERSION,
          originalName: exercise.name,
          displacedName,
          replacementId: exercise._id,
          originalTestCatalogFixture,
          displacedAt: new Date(now),
        },
      });
    }
    operations.push({
      type: "insert",
      id: exercise._id,
      document: {
        ...exercise,
        _stagingSearchIndexCohortFixture: fixtureMarker({
          exercise,
          sourceHash,
          now,
        }),
      },
    });
  }
  const plannedDisplacements = operations
    .filter(({ type }) => type === "displace")
    .map(({ id, displacedName, marker }) => ({
      _id: id,
      name: displacedName,
      _stagingSearchIndexCohortDisplaced: marker,
    }));
  assertExpectedDisplacements(
    [...displacementCandidates(targetExercises), ...plannedDisplacements],
    "STAGING_SEARCH_COHORT_DISPLACEMENT_DRIFT",
  );
  return {
    operation: "sync",
    operations,
    summary: countSummary(operations, unchanged),
  };
};

const planRollback = ({ targetExercises, reviewCounts }) => {
  const { byId } = indexTarget(targetExercises);
  const operations = [];
  for (const { id } of STAGING_SEARCH_INDEX_EXERCISES) {
    const exact = byId.get(id);
    const marker = exact?._stagingSearchIndexCohortFixture;
    if (
      marker?.managed !== true ||
      marker?.key !== STAGING_SEARCH_COHORT_FIXTURE_KEY
    ) {
      throw stagingSearchCohortError(
        "STAGING_SEARCH_COHORT_ROLLBACK_FIXTURE_MISSING",
      );
    }
    if (Number(reviewCounts?.[id] || 0) > 0) {
      throw stagingSearchCohortError(
        "STAGING_SEARCH_COHORT_ROLLBACK_REVIEWS_EXIST",
      );
    }
    if (exercisePayloadHash(exact) !== marker.sourceHash) {
      throw stagingSearchCohortError(
        "STAGING_SEARCH_COHORT_ROLLBACK_CONTENT_DRIFT",
      );
    }
    operations.push({
      type: "delete",
      id,
      expectedSourceHash: marker.sourceHash,
    });
  }

  const displaced = displacementCandidates(targetExercises);
  assertExpectedDisplacements(
    displaced,
    "STAGING_SEARCH_COHORT_ROLLBACK_DISPLACEMENT_DRIFT",
  );
  for (const exercise of displaced) {
    const marker = exercise._stagingSearchIndexCohortDisplaced;
    operations.push({
      type: "restore",
      id: String(exercise._id),
      replacementId: String(marker.replacementId),
      displacedName: marker.displacedName,
      originalName: marker.originalName,
      originalTestCatalogFixture: clone(marker.originalTestCatalogFixture),
    });
  }
  return {
    operation: "rollback",
    operations,
    summary: countSummary(operations),
  };
};

export const buildStagingSearchIndexCohortPlan = ({
  operation,
  sourceExercises = [],
  targetExercises = [],
  reviewCounts = {},
  now = new Date(),
} = {}) => {
  if (operation === "sync") {
    return planSync({ sourceExercises, targetExercises, now });
  }
  if (operation === "rollback") {
    return planRollback({ targetExercises, reviewCounts });
  }
  throw stagingSearchCohortError("STAGING_SEARCH_COHORT_OPERATION_INVALID");
};
