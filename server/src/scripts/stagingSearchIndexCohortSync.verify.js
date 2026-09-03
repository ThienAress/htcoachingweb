import { EXERCISE_MANIFEST } from "../constants/publicTestCatalog.js";
import {
  PLAN_043_FIXTURE_KEY,
  STAGING_SEARCH_COHORT_FIXTURE_KEY,
  STAGING_SEARCH_COHORT_FIXTURE_VERSION,
  STAGING_SEARCH_INDEX_EXERCISES,
  exercisePayloadHash,
  stagingSearchCohortError,
} from "./stagingSearchIndexCohortSync.contract.js";
import { buildStagingSearchIndexCohortPlan } from "./stagingSearchIndexCohortSync.plan.js";

const plan043Names = new Set(EXERCISE_MANIFEST.map(({ name }) => name));
const expectedDisplacements = new Map(
  STAGING_SEARCH_INDEX_EXERCISES.filter(({ name }) =>
    plan043Names.has(name),
  ).map(({ id, name }) => [id, name]),
);
const pinnedIds = new Set(
  STAGING_SEARCH_INDEX_EXERCISES.map(({ id }) => id),
);

const fail = (reason, cause) => {
  const error = stagingSearchCohortError(
    "STAGING_SEARCH_COHORT_POST_VERIFY_FAILED",
    reason,
  );
  if (cause) error.cause = cause;
  throw error;
};

const isPlan079Fixture = (exercise) => {
  const marker = exercise?._stagingSearchIndexCohortFixture;
  return (
    marker?.managed === true &&
    marker?.key === STAGING_SEARCH_COHORT_FIXTURE_KEY &&
    marker?.version === STAGING_SEARCH_COHORT_FIXTURE_VERSION
  );
};

const verifySyncState = ({ sourceExercises, targetExercises, reviewCounts, now }) => {
  const owned = targetExercises.filter(isPlan079Fixture);
  if (
    owned.length !== STAGING_SEARCH_INDEX_EXERCISES.length ||
    owned.some((exercise) => !pinnedIds.has(String(exercise._id)))
  ) {
    fail("The exact Plan 079 fixture set is incomplete or contains extras");
  }

  for (const exercise of owned) {
    const marker = exercise._stagingSearchIndexCohortFixture;
    if (
      exercise._testCatalogFixture ||
      marker.sourceId !== String(exercise._id) ||
      exercisePayloadHash(exercise) !== marker.sourceHash
    ) {
      fail(`Fixture ${String(exercise._id)} does not match its source hash`);
    }
  }

  const rerun = buildStagingSearchIndexCohortPlan({
    operation: "sync",
    sourceExercises,
    targetExercises,
    reviewCounts,
    now,
  });
  if (
    rerun.operations.length !== 0 ||
    rerun.summary.unchanged !== STAGING_SEARCH_INDEX_EXERCISES.length
  ) {
    fail("A second sync would still mutate the target state");
  }

  const displaced = targetExercises.filter(
    (exercise) =>
      exercise?._stagingSearchIndexCohortDisplaced?.managed === true &&
      exercise._stagingSearchIndexCohortDisplaced.key ===
        STAGING_SEARCH_COHORT_FIXTURE_KEY,
  );
  if (displaced.length !== expectedDisplacements.size) {
    fail("The reversible displacement set is incomplete or contains extras");
  }

  const seen = new Set();
  for (const exercise of displaced) {
    const marker = exercise._stagingSearchIndexCohortDisplaced;
    const replacementId = String(marker.replacementId || "");
    if (
      expectedDisplacements.get(replacementId) !== marker.originalName ||
      marker.version !== STAGING_SEARCH_COHORT_FIXTURE_VERSION ||
      marker.displacedName !== exercise.name ||
      marker.originalTestCatalogFixture?.managed !== true ||
      marker.originalTestCatalogFixture?.key !== PLAN_043_FIXTURE_KEY ||
      seen.has(replacementId)
    ) {
      fail("A displaced Plan 043 fixture cannot be restored safely");
    }
    seen.add(replacementId);
  }
};

const verifyRollbackState = ({ targetExercises, reviewCounts }) => {
  if (
    targetExercises.some(
      (exercise) =>
        pinnedIds.has(String(exercise?._id)) ||
        isPlan079Fixture(exercise) ||
        exercise?._stagingSearchIndexCohortDisplaced ||
        String(exercise?.name || "").startsWith("__plan079_displaced__"),
    )
  ) {
    fail("Rollback left a Plan 079 fixture or displacement residue");
  }

  if (
    [...pinnedIds].some((id) => Number(reviewCounts?.[id] || 0) > 0)
  ) {
    fail("Rollback left reviews for a removed Plan 079 fixture");
  }

  for (const originalName of expectedDisplacements.values()) {
    const restored = targetExercises.filter(
      (exercise) => exercise?.name === originalName,
    );
    if (
      restored.length !== 1 ||
      restored[0]._testCatalogFixture?.managed !== true ||
      restored[0]._testCatalogFixture?.key !== PLAN_043_FIXTURE_KEY
    ) {
      fail(`Plan 043 fixture ${originalName} was not restored exactly once`);
    }
  }
};

export const verifyStagingSearchIndexCohortPostState = ({
  operation,
  sourceExercises = [],
  targetExercises = [],
  reviewCounts = {},
  now = new Date(),
} = {}) => {
  try {
    if (operation === "sync") {
      verifySyncState({ sourceExercises, targetExercises, reviewCounts, now });
    } else if (operation === "rollback") {
      verifyRollbackState({ targetExercises, reviewCounts });
    } else {
      fail("Unknown post-verification operation");
    }
  } catch (error) {
    if (error?.code === "STAGING_SEARCH_COHORT_POST_VERIFY_FAILED") {
      throw error;
    }
    fail(error?.code || "Post-transaction verification failed", error);
  }
  return { verified: true, operation };
};
