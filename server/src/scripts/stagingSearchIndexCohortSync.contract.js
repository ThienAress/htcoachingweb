import { createHash } from "node:crypto";

import { validateStagingEnvironment } from "../config/stagingSafety.js";
import { assertStagingOperation } from "../config/stagingOperationSafety.js";
import { createStagingSearchIndexCohortSnapshotDigest } from "./stagingSearchIndexCohortSync.digest.js";

export const PLAN_043_FIXTURE_KEY = "plan-043-public-test-catalog";
export const STAGING_SEARCH_COHORT_FIXTURE_KEY =
  "plan-079-staging-search-cohort";
export const STAGING_SEARCH_COHORT_FIXTURE_VERSION = "2026-09-02-v1";
export const STAGING_SEARCH_COHORT_APPLY_CONFIRMATION =
  "CONFIRM_STAGING_SEARCH_INDEX_COHORT_SYNC";
export const STAGING_SEARCH_COHORT_ROLLBACK_CONFIRMATION =
  "CONFIRM_STAGING_SEARCH_INDEX_COHORT_ROLLBACK";
export const STAGING_SEARCH_COHORT_PLAN_DIGEST_VARIABLE =
  "STAGING_SEARCH_INDEX_COHORT_EXPECTED_PLAN_DIGEST";
const STAGING_SEARCH_COHORT_PLAN_DIGEST_ARGUMENT = "--expected-plan-digest=";

export const STAGING_SEARCH_INDEX_EXERCISES = Object.freeze(
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

const STAGING_DATABASE = "htcoaching_staging";
const expectedById = new Map(
  STAGING_SEARCH_INDEX_EXERCISES.map(({ id, name }) => [id, name]),
);
const TECHNICAL_DIFFICULTY_CRITERIA = [
  "coordination",
  "stability",
  "mobility",
  "setup",
  "errorConsequence",
];

export const stagingSearchCohortError = (code, message = code) =>
  Object.assign(new Error(`${code}: ${message}`), { code });

const databaseName = (uri) => {
  try {
    return decodeURIComponent(new URL(String(uri || "")).pathname)
      .replace(/^\/+/, "")
      .split("/")[0];
  } catch {
    return "";
  }
};

const readExpectedPlanDigest = (argv, env) => {
  const cliDigests = argv
    .filter((argument) =>
      argument.startsWith(STAGING_SEARCH_COHORT_PLAN_DIGEST_ARGUMENT),
    )
    .map((argument) =>
      argument.slice(STAGING_SEARCH_COHORT_PLAN_DIGEST_ARGUMENT.length)
        .trim()
        .toLowerCase(),
    );
  const envDigest = String(
    env[STAGING_SEARCH_COHORT_PLAN_DIGEST_VARIABLE] || "",
  )
    .trim()
    .toLowerCase();
  const supplied = [...cliDigests, ...(envDigest ? [envDigest] : [])];
  if (supplied.length === 0) {
    throw stagingSearchCohortError(
      "STAGING_SEARCH_COHORT_PLAN_DIGEST_REQUIRED",
    );
  }
  if (supplied.some((digest) => !/^[a-f0-9]{64}$/.test(digest))) {
    throw stagingSearchCohortError(
      "STAGING_SEARCH_COHORT_PLAN_DIGEST_INVALID",
    );
  }
  const unique = new Set(supplied);
  if (unique.size !== 1) {
    throw stagingSearchCohortError(
      "STAGING_SEARCH_COHORT_PLAN_DIGEST_CONFLICT",
    );
  }
  return supplied[0];
};

export const validateStagingSearchIndexCohortAuthorization = ({
  argv = [],
  env = process.env,
} = {}) => {
  const args = new Set(argv);
  const target = [...args]
    .find((argument) => argument.startsWith("--target="))
    ?.slice("--target=".length);
  if (target !== "staging") {
    throw stagingSearchCohortError(
      "STAGING_SEARCH_COHORT_TARGET_REQUIRED",
      "Only --target=staging is accepted",
    );
  }
  if (
    String(env.APP_ENV || "").toLowerCase() !== "staging" ||
    databaseName(env.MONGO_URI) !== STAGING_DATABASE ||
    String(env.MIGRATION_TARGET_DATABASE || "") !== STAGING_DATABASE
  ) {
    throw stagingSearchCohortError(
      "STAGING_SEARCH_COHORT_DATABASE_GUARD_FAILED",
      "APP_ENV, MONGO_URI and MIGRATION_TARGET_DATABASE must lock staging",
    );
  }
  const safety = validateStagingEnvironment(env);
  if (!safety.valid) {
    throw stagingSearchCohortError(
      "STAGING_SEARCH_COHORT_ENVIRONMENT_REJECTED",
      safety.errors.map(({ code }) => code).join(", "),
    );
  }

  const operation = args.has("--rollback") ? "rollback" : "sync";
  const apply = args.has("--apply");
  let expectedPlanDigest = "";
  if (apply) {
    const rollback = operation === "rollback";
    const flag = rollback
      ? "--confirm-search-index-cohort-rollback"
      : "--confirm-search-index-cohort";
    const confirmationVariable = rollback
      ? STAGING_SEARCH_COHORT_ROLLBACK_CONFIRMATION
      : STAGING_SEARCH_COHORT_APPLY_CONFIRMATION;
    if (
      !args.has(flag) ||
      String(env[confirmationVariable] || "").toLowerCase() !== "yes"
    ) {
      throw stagingSearchCohortError(
        rollback
          ? "STAGING_SEARCH_COHORT_ROLLBACK_CONFIRMATION_REQUIRED"
          : "STAGING_SEARCH_COHORT_APPLY_CONFIRMATION_REQUIRED",
      );
    }
    expectedPlanDigest = readExpectedPlanDigest(argv, env);
    assertStagingOperation({ env, confirmationVariable });
  }
  return {
    target,
    operation,
    apply,
    targetDatabase: STAGING_DATABASE,
    expectedPlanDigest,
  };
};

export const createStagingSearchIndexCohortPlanDigest = ({
  operation,
  sourceExercises = [],
  targetExercises = [],
  reviewCounts = {},
} = {}) =>
  createStagingSearchIndexCohortSnapshotDigest({
    fixtureVersion: STAGING_SEARCH_COHORT_FIXTURE_VERSION,
    operation,
    sourceExercises,
    targetExercises,
    reviewCounts,
  });

const wordCount = (value) =>
  String(value || "")
    .trim()
    .split(/\s+/u)
    .filter(Boolean).length;

const normalizedText = (value) =>
  String(value || "")
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .trim()
    .toLowerCase()
    .replace(/\s+/gu, " ");

export const assertUniqueSearchCohortDescriptions = (exercises) => {
  const descriptions = new Set();
  for (const exercise of exercises) {
    const description = normalizedText(exercise?.description);
    if (descriptions.has(description)) {
      throw stagingSearchCohortError(
        "STAGING_SEARCH_COHORT_SOURCE_DESCRIPTION_DUPLICATE",
      );
    }
    descriptions.add(description);
  }
};

const isHttpsUrl = (value) => {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
};

const validInstructions = (instructions) => {
  if (!Array.isArray(instructions) || instructions.length < 3) return false;
  if (
    instructions.some(
      (step) =>
        String(step?.title || "").trim().length < 2 ||
        String(step?.description || "").trim().length < 40,
    )
  ) {
    return false;
  }
  return (
    instructions.reduce(
      (total, step) => total + String(step.description).trim().length,
      0,
    ) >= 240
  );
};

const isEligibleSourceExercise = (exercise) => {
  const description = String(exercise?.description || "").trim();
  return (
    String(exercise?.name || "").trim().length >= 2 &&
    String(exercise?.muscleGroup || "").trim().length >= 2 &&
    description.length >= 120 &&
    wordCount(description) >= 20 &&
    isHttpsUrl(exercise?.imageUrl) &&
    validInstructions(exercise?.instructions) &&
    TECHNICAL_DIFFICULTY_CRITERIA.every((criterion) => {
      const score = exercise?.technicalDifficulty?.[criterion];
      return Number.isInteger(score) && score >= 0 && score <= 2;
    })
  );
};

const normalizeDate = (value) => {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

export const sanitizeSearchCohortExercise = (exercise) => {
  const id = String(exercise?._id || "");
  const expectedName = expectedById.get(id);
  if (
    !expectedName ||
    exercise?.name !== expectedName ||
    !isEligibleSourceExercise(exercise)
  ) {
    throw stagingSearchCohortError(
      "STAGING_SEARCH_COHORT_SOURCE_INELIGIBLE",
      `Pinned Exercise ${id || "unknown"} is missing, mismatched or ineligible`,
    );
  }
  const createdAt = normalizeDate(exercise.createdAt);
  const updatedAt = normalizeDate(exercise.updatedAt);
  return {
    _id: id,
    name: exercise.name,
    muscleGroup: String(exercise.muscleGroup),
    description: String(exercise.description),
    videoUrl: String(exercise.videoUrl || ""),
    imageUrl: String(exercise.imageUrl),
    instructions: exercise.instructions.map(({ title, description }) => ({
      title: String(title),
      description: String(description || ""),
    })),
    technicalDifficulty: {
      ...Object.fromEntries(
        TECHNICAL_DIFFICULTY_CRITERIA.map((criterion) => [
          criterion,
          exercise.technicalDifficulty[criterion],
        ]),
      ),
      rationale: String(exercise.technicalDifficulty.rationale || ""),
    },
    ...(createdAt ? { createdAt } : {}),
    ...(updatedAt ? { updatedAt } : {}),
  };
};

export const exercisePayloadHash = (exercise) => {
  const { createdAt: _createdAt, updatedAt: _updatedAt, ...content } =
    sanitizeSearchCohortExercise({
      ...exercise,
      _id: String(exercise?._id || ""),
    });
  return createHash("sha256").update(JSON.stringify(content)).digest("hex");
};
