import { pathToFileURL } from "node:url";

import mongoose from "mongoose";

import {
  assertConnectedMigrationTarget,
  assertMigrationEnvironment,
  getMongoDatabaseName,
} from "../config/migrationSafety.js";
import RecipeReview from "../models/RecipeReview.js";

const CONFIRMATION_VARIABLE = "CONFIRM_RECIPE_REVIEW_INDEX_MIGRATION";
const TARGET_INDEX_NAMES = new Set([
  "uniq_recipe_review_user",
  "recipe_reviews_recipe_created",
]);

const normalizeObject = (value = {}) =>
  Object.fromEntries(Object.entries(value).map(([key, item]) => [key, String(item)]));

const contracts = () =>
  RecipeReview.schema
    .indexes()
    .filter(([, options]) => TARGET_INDEX_NAMES.has(options.name))
    .map(([keys, options]) => ({ keys, options, name: options.name }));

const sameContract = (existing, contract) =>
  JSON.stringify(normalizeObject(existing.key)) ===
    JSON.stringify(normalizeObject(contract.keys)) &&
  Boolean(existing.unique) === Boolean(contract.options.unique);

const listIndexes = async () => {
  try {
    return await RecipeReview.collection.listIndexes().toArray();
  } catch (error) {
    if (error?.code === 26 || error?.codeName === "NamespaceNotFound") return [];
    throw error;
  }
};

const duplicateCount = async (contract) => {
  if (!contract.options.unique) return 0;
  try {
    const [result] = await RecipeReview.collection.aggregate([
      {
        $group: {
          _id: Object.fromEntries(Object.keys(contract.keys).map((field) => [field, `$${field}`])),
          count: { $sum: 1 },
        },
      },
      { $match: { count: { $gt: 1 } } },
      { $count: "count" },
    ]).toArray();
    return result?.count || 0;
  } catch (error) {
    if (error?.code === 26 || error?.codeName === "NamespaceNotFound") return 0;
    throw error;
  }
};

export const inspectRecipeReviewIndexes = async () => {
  const existing = await listIndexes();
  const reports = [];
  for (const contract of contracts()) {
    const sameName = existing.find(({ name }) => name === contract.name);
    const equivalent = existing.find((index) => sameContract(index, contract));
    reports.push({
      contract,
      duplicateGroupCount: await duplicateCount(contract),
      status: equivalent ? "present" : sameName ? "name_conflict" : "missing",
    });
  }
  if (reports.length !== TARGET_INDEX_NAMES.size) {
    throw new Error("Recipe review index contract manifest is incomplete");
  }
  return reports;
};

export const applyRecipeReviewIndexes = async (reports) => {
  if (reports.some(({ duplicateGroupCount, status }) => duplicateGroupCount || status === "name_conflict")) {
    throw new Error("Recipe review index apply blocked by preflight findings");
  }
  const applied = [];
  for (const { contract, status } of reports) {
    if (status === "present") {
      applied.push({ name: contract.name, status: "unchanged" });
      continue;
    }
    const name = await RecipeReview.collection.createIndex(contract.keys, contract.options);
    applied.push({ name, status: "created" });
  }
  return applied;
};

export const authorizeRecipeReviewIndexTarget = ({ args, apply, env = process.env }) => {
  const target = [...args]
    .find((argument) => argument.startsWith("--target="))
    ?.slice("--target=".length);
  if (!new Set(["staging", "production"]).has(target)) {
    throw new Error("Use an explicit --target=staging or --target=production");
  }
  if (env.APP_ENV !== target) throw new Error("Recipe review index target does not match APP_ENV");
  if (!env.MONGO_URI) throw new Error("MONGO_URI is required");
  const uriDatabase = getMongoDatabaseName(env.MONGO_URI);
  const targetDatabase = String(env.MIGRATION_TARGET_DATABASE || "").trim();
  if (!uriDatabase || !targetDatabase || uriDatabase !== targetDatabase) {
    throw new Error("Recipe review index database target lock failed");
  }
  if (!apply) return { targetDatabase, valid: true };
  if (!args.has("--confirm-recipe-review-indexes")) {
    throw new Error("Apply requires --confirm-recipe-review-indexes");
  }
  return assertMigrationEnvironment({ env, confirmationVariable: CONFIRMATION_VARIABLE });
};

const safeReports = (reports) =>
  reports.map(({ contract, duplicateGroupCount, status }) => ({
    collection: RecipeReview.collection.name,
    name: contract.name,
    unique: Boolean(contract.options.unique),
    duplicateGroupCount,
    status,
  }));

const main = async () => {
  const args = new Set(process.argv.slice(2));
  const apply = args.has("--apply");
  const authorization = authorizeRecipeReviewIndexTarget({ args, apply });
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });
  try {
    assertConnectedMigrationTarget(mongoose.connection, authorization);
    const reports = await inspectRecipeReviewIndexes();
    if (reports.some(({ duplicateGroupCount, status }) => duplicateGroupCount || status === "name_conflict")) {
      throw new Error("Recipe review index preflight blocked");
    }
    const applied = apply ? await applyRecipeReviewIndexes(reports) : [];
    const verification = apply ? await inspectRecipeReviewIndexes() : reports;
    const success = !apply || verification.every(({ status }) => status === "present");
    console.log(JSON.stringify({ mode: apply ? "apply" : "preflight", success, indexes: safeReports(verification), applied }, null, 2));
    if (!success) throw new Error("Recipe review index verification failed");
  } finally {
    await mongoose.disconnect();
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
