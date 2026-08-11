import {
  EXERCISE_MANIFEST,
  EXPECTED_MUSCLE_GROUPS,
  FOOD_MANIFEST,
} from "../constants/publicTestCatalog.js";
import { validateStagingOperation } from "../config/stagingOperationSafety.js";

export { EXERCISE_MANIFEST, EXPECTED_MUSCLE_GROUPS, FOOD_MANIFEST };

export const FIXTURE_KEY = "plan-043-public-test-catalog";
export const LOCAL_DATABASE = "htcoaching_local";
export const STAGING_DATABASE = "htcoaching_staging";
export const LOCAL_MONGO_URI =
  "mongodb://127.0.0.1:27017/htcoaching_local?replicaSet=rs0";
const STAGING_CONFIRMATION = "CONFIRM_STAGING_TEST_CATALOG_SYNC";

export const makeTestCatalogError = (code, message = code) =>
  Object.assign(new Error(message), { code });

const getMongoTarget = (value) => {
  try {
    const url = new URL(String(value || ""));
    return {
      hostname: url.hostname.toLowerCase(),
      database: decodeURIComponent(url.pathname)
        .replace(/^\/+/, "")
        .split("/")[0],
    };
  } catch {
    return { hostname: "", database: "" };
  }
};

export const validateLocalTarget = (mongoUri) => {
  const { hostname, database } = getMongoTarget(mongoUri);
  const errors = [];
  if (!["127.0.0.1", "localhost", "::1"].includes(hostname)) {
    errors.push("LOCAL_TEST_CATALOG_HOST_REQUIRED");
  }
  if (database !== LOCAL_DATABASE) {
    errors.push("LOCAL_TEST_CATALOG_DATABASE_REQUIRED");
  }
  return { valid: errors.length === 0, errors };
};

export const validateSyncTarget = ({
  target,
  env = process.env,
  mongoUri = target === "local" ? LOCAL_MONGO_URI : env.MONGO_URI,
} = {}) => {
  if (target === "local") return validateLocalTarget(mongoUri);
  if (target === "staging") {
    return validateStagingOperation({
      env,
      confirmationVariable: STAGING_CONFIRMATION,
    });
  }
  return { valid: false, errors: ["TEST_CATALOG_TARGET_INVALID"] };
};

export const assertSyncTarget = (options) => {
  const result = validateSyncTarget(options);
  if (!result.valid) {
    throw makeTestCatalogError(
      "TEST_CATALOG_TARGET_REJECTED",
      `Test catalog target rejected: ${result.errors.join(", ")}`,
    );
  }
};

export const validateManifestContract = () => {
  const exerciseNames = EXERCISE_MANIFEST.map(({ name }) => name);
  const foodLabels = FOOD_MANIFEST.map(({ label }) => label);
  const groups = new Set(EXERCISE_MANIFEST.map(({ muscleGroup }) => muscleGroup));
  const macroCounts = Object.fromEntries(
    ["protein", "carb", "fat"].map((macroGroup) => [
      macroGroup,
      FOOD_MANIFEST.filter((item) => item.macroGroup === macroGroup).length,
    ]),
  );
  if (
    exerciseNames.length !== 20 ||
    new Set(exerciseNames).size !== 20 ||
    foodLabels.length !== 20 ||
    new Set(foodLabels).size !== 20 ||
    groups.size !== EXPECTED_MUSCLE_GROUPS.length ||
    EXPECTED_MUSCLE_GROUPS.some((group) => !groups.has(group)) ||
    JSON.stringify(macroCounts) !== JSON.stringify({ protein: 7, carb: 7, fat: 6 })
  ) {
    throw makeTestCatalogError("TEST_CATALOG_MANIFEST_INVALID");
  }
};

export const classifyFixtureRecord = (existing) => {
  if (!existing) return "insert";
  const marker = existing._testCatalogFixture;
  return marker?.managed === true && marker?.key === FIXTURE_KEY
    ? "update"
    : "skip";
};

const dominantMacro = ({ protein, carb, fat }) =>
  Object.entries({ protein, carb, fat }).sort(
    (left, right) => right[1] - left[1],
  )[0]?.[0];

const selectExact = (rows, manifest, identityField, kind) => {
  if (!Array.isArray(rows)) {
    throw makeTestCatalogError(`TEST_CATALOG_${kind}_SOURCE_INVALID`);
  }
  return manifest.map((entry) => {
    const matches = rows.filter(
      (row) => row?.[identityField] === entry[identityField],
    );
    if (matches.length !== 1) {
      throw makeTestCatalogError(`TEST_CATALOG_${kind}_EXACT_MATCH_REQUIRED`);
    }
    return { source: matches[0], manifest: entry };
  });
};

const sanitizeExercise = ({ source, manifest }) => {
  if (source.muscleGroup !== manifest.muscleGroup) {
    throw makeTestCatalogError("TEST_CATALOG_EXERCISE_GROUP_DRIFT");
  }
  return {
    name: source.name,
    muscleGroup: source.muscleGroup,
    description: String(source.description || ""),
    videoUrl: String(source.videoUrl || ""),
    imageUrl: String(source.imageUrl || ""),
  };
};

const cloneObject = (value, fallback) =>
  value && typeof value === "object"
    ? JSON.parse(JSON.stringify(value))
    : fallback;

const sanitizeFood = ({ source, manifest }) => {
  const macros = Object.fromEntries(
    ["protein", "carb", "fat", "calories"].map((field) => [
      field,
      Number(source[field]),
    ]),
  );
  if (Object.values(macros).some((value) => !Number.isFinite(value) || value < 0)) {
    throw makeTestCatalogError("TEST_CATALOG_FOOD_MACRO_INVALID");
  }
  if (dominantMacro(macros) !== manifest.macroGroup) {
    throw makeTestCatalogError("TEST_CATALOG_FOOD_MACRO_GROUP_DRIFT");
  }
  return {
    label: source.label,
    ...macros,
    nutritionBasis: source.nutritionBasis || "per_100g",
    source: cloneObject(source.source, { type: "legacy_unknown" }),
    allergenProfile: cloneObject(source.allergenProfile, {
      reviewStatus: "unreviewed",
    }),
  };
};

export const selectSourceCatalog = ({ exercises, foods }) => {
  validateManifestContract();
  return {
    exercises: selectExact(
      exercises,
      EXERCISE_MANIFEST,
      "name",
      "EXERCISE",
    ).map(sanitizeExercise),
    foods: selectExact(foods, FOOD_MANIFEST, "label", "FOOD").map(sanitizeFood),
  };
};
