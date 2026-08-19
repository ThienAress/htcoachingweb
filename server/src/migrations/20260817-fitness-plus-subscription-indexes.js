import { pathToFileURL } from "node:url";

import mongoose from "mongoose";

import {
  assertConnectedMigrationTarget,
  assertMigrationEnvironment,
  getMongoDatabaseName,
} from "../config/migrationSafety.js";
import FitnessSubscription from "../models/FitnessSubscription.js";
import FitnessPlusQuotaUsage from "../models/FitnessPlusQuotaUsage.js";

const CONFIRMATION_VARIABLE = "CONFIRM_FITNESS_PLUS_INDEX_MIGRATION";
const TARGET_INDEX_NAMES = new Set([
  "fitness_subscription_user_status",
  "fitness_subscription_end_status",
  "uniq_active_fitness_plus_subscription",
  "uniq_fitness_plus_purchase_request",
  "uniq_fitness_plus_quota_usage",
  "fitness_plus_quota_usage_ttl",
]);
const MODELS = [FitnessSubscription, FitnessPlusQuotaUsage];

const normalizeObject = (value = {}) =>
  Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, String(item)]),
  );

const comparableOptions = (value = {}) => ({
  unique: Boolean(value.unique),
  partialFilterExpression: value.partialFilterExpression || null,
  expireAfterSeconds: value.expireAfterSeconds ?? null,
});

const sameContract = (existing, contract) =>
  JSON.stringify(normalizeObject(existing.key)) ===
    JSON.stringify(normalizeObject(contract.keys)) &&
  JSON.stringify(comparableOptions(existing)) ===
    JSON.stringify(comparableOptions(contract.options));

export const getFitnessPlusIndexContracts = () =>
  MODELS.flatMap((model) =>
    model.schema
      .indexes()
      .filter(([, options]) => TARGET_INDEX_NAMES.has(options.name))
      .map(([keys, options]) => ({
        model,
        collection: model.collection.name,
        name: options.name,
        keys,
        options,
      })),
  );

const isMissingNamespace = (error) =>
  error?.code === 26 || error?.codeName === "NamespaceNotFound";

const listIndexes = async (collection) => {
  try {
    return await collection.listIndexes().toArray();
  } catch (error) {
    if (isMissingNamespace(error)) return [];
    throw error;
  }
};

const countDuplicateGroups = async (contract) => {
  if (!contract.options.unique) return 0;
  const pipeline = [];
  if (contract.options.partialFilterExpression) {
    pipeline.push({ $match: contract.options.partialFilterExpression });
  }
  pipeline.push(
    {
      $group: {
        _id: Object.fromEntries(
          Object.keys(contract.keys).map((field) => [field, `$${field}`]),
        ),
        count: { $sum: 1 },
      },
    },
    { $match: { count: { $gt: 1 } } },
    { $count: "count" },
  );

  try {
    const [result] = await contract.model.collection.aggregate(pipeline).toArray();
    return result?.count || 0;
  } catch (error) {
    if (isMissingNamespace(error)) return 0;
    throw error;
  }
};

export const inspectFitnessPlusIndexes = async () => {
  const existingByCollection = new Map();
  const reports = [];
  for (const contract of getFitnessPlusIndexContracts()) {
    if (!existingByCollection.has(contract.collection)) {
      existingByCollection.set(
        contract.collection,
        await listIndexes(contract.model.collection),
      );
    }
    const existing = existingByCollection.get(contract.collection);
    const sameName = existing.find(({ name }) => name === contract.name);
    const equivalent = existing.find((index) => sameContract(index, contract));
    reports.push({
      contract,
      duplicateGroupCount: await countDuplicateGroups(contract),
      status: equivalent ? "present" : sameName ? "name_conflict" : "missing",
    });
  }
  if (reports.length !== TARGET_INDEX_NAMES.size) {
    throw new Error("HT Fitness+ index contract manifest is incomplete");
  }
  return reports;
};

export const applyFitnessPlusIndexes = async (reports) => {
  if (
    reports.some(
      ({ duplicateGroupCount, status }) =>
        duplicateGroupCount > 0 || status === "name_conflict",
    )
  ) {
    throw new Error("HT Fitness+ index apply blocked by preflight findings");
  }

  const applied = [];
  for (const report of reports) {
    if (report.status === "present") {
      applied.push({ name: report.contract.name, status: "unchanged" });
      continue;
    }
    const name = await report.contract.model.collection.createIndex(
      report.contract.keys,
      report.contract.options,
    );
    applied.push({ name, status: "created" });
  }
  return applied;
};

export const authorizeFitnessPlusIndexTarget = ({
  args,
  apply,
  env = process.env,
}) => {
  const targetArgument = [...args].find((argument) =>
    argument.startsWith("--target="),
  );
  const target = targetArgument?.slice("--target=".length);
  if (!new Set(["staging", "production"]).has(target)) {
    throw new Error("Use an explicit --target=staging or --target=production");
  }
  if (env.APP_ENV !== target) {
    throw new Error("HT Fitness+ index target does not match APP_ENV");
  }
  if (!env.MONGO_URI) throw new Error("MONGO_URI is required");

  const uriDatabase = getMongoDatabaseName(env.MONGO_URI);
  const targetDatabase = String(env.MIGRATION_TARGET_DATABASE || "").trim();
  if (!uriDatabase || !targetDatabase || uriDatabase !== targetDatabase) {
    throw new Error("HT Fitness+ index database target lock failed");
  }
  if (!apply) return { targetDatabase, valid: true };
  if (!args.has("--confirm-fitness-plus-indexes")) {
    throw new Error("Apply requires --confirm-fitness-plus-indexes");
  }
  return assertMigrationEnvironment({
    env,
    confirmationVariable: CONFIRMATION_VARIABLE,
  });
};

const safeReports = (reports) =>
  reports.map(({ contract, duplicateGroupCount, status }) => ({
    collection: contract.collection,
    name: contract.name,
    unique: Boolean(contract.options.unique),
    duplicateGroupCount,
    status,
  }));

const main = async () => {
  const args = new Set(process.argv.slice(2));
  const apply = args.has("--apply");
  const authorization = authorizeFitnessPlusIndexTarget({ args, apply });
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });
  try {
    assertConnectedMigrationTarget(mongoose.connection, authorization);
    const reports = await inspectFitnessPlusIndexes();
    const blocked = reports.some(
      ({ duplicateGroupCount, status }) =>
        duplicateGroupCount > 0 || status === "name_conflict",
    );
    if (blocked) throw new Error("HT Fitness+ index preflight blocked");

    const applied = apply ? await applyFitnessPlusIndexes(reports) : [];
    const verification = apply ? await inspectFitnessPlusIndexes() : reports;
    const success =
      !apply || verification.every(({ status }) => status === "present");
    console.log(
      JSON.stringify(
        {
          mode: apply ? "apply" : "preflight",
          success,
          indexes: safeReports(verification),
          applied,
        },
        null,
        2,
      ),
    );
    if (!success) throw new Error("HT Fitness+ index verification failed");
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
