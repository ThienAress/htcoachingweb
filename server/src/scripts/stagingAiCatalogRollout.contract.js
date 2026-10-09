import { createHash } from "node:crypto";

import { validateStagingEnvironment } from "../config/stagingSafety.js";
import { assertStagingOperation } from "../config/stagingOperationSafety.js";
import { PLAN_043_FIXTURE_KEY } from "./stagingSearchIndexCohortSync.contract.js";

export { PLAN_043_FIXTURE_KEY };

export const STAGING_AI_CATALOG_ROLLOUT_KEY =
  "plan-092-staging-ai-catalog";
export const STAGING_AI_CATALOG_ROLLOUT_VERSION = "2026-09-18-v1";
export const STAGING_AI_CATALOG_APPLY_CONFIRMATION =
  "CONFIRM_STAGING_AI_CATALOG_ROLLOUT";
export const STAGING_AI_CATALOG_ROLLBACK_CONFIRMATION =
  "CONFIRM_STAGING_AI_CATALOG_ROLLBACK";
export const STAGING_AI_CATALOG_PLAN_DIGEST_VARIABLE =
  "STAGING_AI_CATALOG_EXPECTED_PLAN_DIGEST";
export const STAGING_AI_CATALOG_MONGO_CONNECT_OPTIONS = Object.freeze({
  autoIndex: false,
  autoCreate: false,
});

const STAGING_DATABASE = "htcoaching_staging";
const DIGEST_ARGUMENT = "--expected-plan-digest=";
const FDA_BIG_9_SOURCE =
  "https://www.fda.gov/food/buy-store-serve-safe-food/food-allergies-what-you-need-know";
const USDA_FSIS_BIG_9_SOURCE =
  "https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/food-safety-basics/food-allergies-big-9";

export const STAGING_AI_CATALOG_EXERCISES = Object.freeze(
  [
    ["6a4b4c41a5de82055378b184", "Kneeling Push-up (male)"],
    ["6a4b4c8ea5de82055378b335", "Push-up"],
    ["6a4b4c90a5de82055378b33f", "Push-up (wall)"],
    ["6a4b4c90a5de82055378b342", "Push-up (wall) V. 2"],
    ["6a4b4cb2a5de82055378b3ca", "Scapula Push-up"],
  ].map(([id, name]) => Object.freeze({ id, name })),
);

export const STAGING_AI_CATALOG_FOODS = Object.freeze([
  Object.freeze({
    label: "Ức gà",
    macroGroup: "protein",
    identitySourceUrl:
      "https://fdc.nal.usda.gov/food-search/?query=chicken%20breast%20boneless%20skinless%20raw",
    allergenTaxonomySourceUrl: USDA_FSIS_BIG_9_SOURCE,
    specificContains: Object.freeze(["chicken"]),
  }),
  Object.freeze({
    label: "Khoai tây",
    macroGroup: "carb",
    identitySourceUrl: "https://fdc.nal.usda.gov/food-search/?query=potatoes%20raw",
    allergenTaxonomySourceUrl: FDA_BIG_9_SOURCE,
    specificContains: Object.freeze([]),
  }),
  Object.freeze({
    label: "Bơ trái",
    macroGroup: "fat",
    identitySourceUrl: "https://fdc.nal.usda.gov/food-search/?query=avocado%20raw",
    allergenTaxonomySourceUrl: FDA_BIG_9_SOURCE,
    specificContains: Object.freeze([]),
  }),
]);

export const stagingAiCatalogError = (code, message = code) =>
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

const readExpectedDigest = (argv, env) => {
  const cli = argv
    .filter((argument) => argument.startsWith(DIGEST_ARGUMENT))
    .map((argument) => argument.slice(DIGEST_ARGUMENT.length).trim().toLowerCase());
  const fromEnv = String(env[STAGING_AI_CATALOG_PLAN_DIGEST_VARIABLE] || "")
    .trim()
    .toLowerCase();
  const supplied = [...cli, ...(fromEnv ? [fromEnv] : [])];
  if (supplied.length === 0) {
    throw stagingAiCatalogError("STAGING_AI_CATALOG_PLAN_DIGEST_REQUIRED");
  }
  if (supplied.some((digest) => !/^[a-f0-9]{64}$/.test(digest))) {
    throw stagingAiCatalogError("STAGING_AI_CATALOG_PLAN_DIGEST_INVALID");
  }
  if (new Set(supplied).size !== 1) {
    throw stagingAiCatalogError("STAGING_AI_CATALOG_PLAN_DIGEST_CONFLICT");
  }
  return supplied[0];
};

export const validateStagingAiCatalogAuthorization = ({
  argv = [],
  env = process.env,
} = {}) => {
  const args = new Set(argv);
  const target = argv
    .find((argument) => argument.startsWith("--target="))
    ?.slice("--target=".length);
  if (target !== "staging") {
    throw stagingAiCatalogError("STAGING_AI_CATALOG_TARGET_REQUIRED");
  }
  if (
    String(env.APP_ENV || "").toLowerCase() !== "staging" ||
    databaseName(env.MONGO_URI) !== STAGING_DATABASE ||
    String(env.MIGRATION_TARGET_DATABASE || "") !== STAGING_DATABASE
  ) {
    throw stagingAiCatalogError("STAGING_AI_CATALOG_DATABASE_GUARD_FAILED");
  }
  const staging = validateStagingEnvironment(env);
  if (!staging.valid) {
    throw stagingAiCatalogError(
      "STAGING_AI_CATALOG_ENVIRONMENT_REJECTED",
      staging.errors.map(({ code }) => code).join(", "),
    );
  }

  const operation = args.has("--rollback") ? "rollback" : "sync";
  const apply = args.has("--apply");
  let expectedPlanDigest = "";
  if (apply) {
    const rollback = operation === "rollback";
    const flag = rollback
      ? "--confirm-ai-catalog-rollback"
      : "--confirm-ai-catalog-rollout";
    const confirmationVariable = rollback
      ? STAGING_AI_CATALOG_ROLLBACK_CONFIRMATION
      : STAGING_AI_CATALOG_APPLY_CONFIRMATION;
    if (
      !args.has(flag) ||
      String(env[confirmationVariable] || "").toLowerCase() !== "yes"
    ) {
      throw stagingAiCatalogError(
        rollback
          ? "STAGING_AI_CATALOG_ROLLBACK_CONFIRMATION_REQUIRED"
          : "STAGING_AI_CATALOG_APPLY_CONFIRMATION_REQUIRED",
      );
    }
    expectedPlanDigest = readExpectedDigest(argv, env);
    assertStagingOperation({ env, confirmationVariable });
  }
  return {
    target,
    targetDatabase: STAGING_DATABASE,
    operation,
    apply,
    expectedPlanDigest,
  };
};

const canonicalize = (value) => {
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value.toHexString === "function") return value.toHexString();
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .filter((key) => value[key] !== undefined)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
};

export const hashStagingAiCatalogPayload = (value) =>
  createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");

const sortDocuments = (rows = []) => [...rows].sort((left, right) =>
  String(left?._id || "").localeCompare(String(right?._id || "")));

export const createStagingAiCatalogPlanDigest = ({ operation, source, target }) =>
  hashStagingAiCatalogPayload({
    version: STAGING_AI_CATALOG_ROLLOUT_VERSION,
    operation,
    source: operation === "sync" ? source : null,
    target: {
      exercises: sortDocuments(target?.exercises),
      foods: sortDocuments(target?.foods),
      priceObservations: sortDocuments(target?.priceObservations),
      exerciseReviewCounts: target?.exerciseReviewCounts || {},
    },
  });
