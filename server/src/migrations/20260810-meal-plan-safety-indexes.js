import { pathToFileURL } from "node:url";

import mongoose from "mongoose";

import FoodPriceObservation from "../models/FoodPriceObservation.js";

const TARGET_INDEX_NAMES = new Set([
  "food_price_lookup",
  "uniq_food_price_observation",
]);

export const getMealPlanSafetyIndexContracts = () =>
  FoodPriceObservation.schema
    .indexes()
    .filter(([, options]) => TARGET_INDEX_NAMES.has(options.name))
    .map(([keys, options]) => ({
      collection: FoodPriceObservation.collection.name,
      name: options.name,
      keys,
      options,
    }));

const listIndexes = async () => {
  try {
    return await FoodPriceObservation.collection.listIndexes().toArray();
  } catch (error) {
    if (error?.code === 26 || error?.codeName === "NamespaceNotFound") return [];
    throw error;
  }
};

const sameContract = (existing, contract) =>
  JSON.stringify(existing.key) === JSON.stringify(contract.keys) &&
  Boolean(existing.unique) === Boolean(contract.options.unique);

const countDuplicateGroups = async (contract) => {
  if (!contract.options.unique) return 0;
  const groupId = Object.fromEntries(
    Object.keys(contract.keys).map((field) => [field, `$${field}`]),
  );
  const [result] = await FoodPriceObservation.collection
    .aggregate([
      { $group: { _id: groupId, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $count: "count" },
    ])
    .toArray();
  return result?.count || 0;
};

export const inspectMealPlanSafetyIndexes = async () => {
  const existing = await listIndexes();
  const reports = [];
  for (const contract of getMealPlanSafetyIndexContracts()) {
    const sameName = existing.find(({ name }) => name === contract.name);
    const equivalent = existing.find((index) => sameContract(index, contract));
    reports.push({
      contract,
      duplicateGroupCount: await countDuplicateGroups(contract),
      status: equivalent ? "present" : sameName ? "name_conflict" : "missing",
    });
  }
  return reports;
};

export const applyMealPlanSafetyIndexes = async (reports) => {
  const applied = [];
  for (const report of reports) {
    if (report.status === "present") {
      applied.push({ name: report.contract.name, status: "unchanged" });
      continue;
    }
    const name = await FoodPriceObservation.collection.createIndex(
      report.contract.keys,
      report.contract.options,
    );
    applied.push({ name, status: "created" });
  }
  return applied;
};

const main = async () => {
  const args = new Set(process.argv.slice(2));
  const apply = args.has("--apply");
  if (
    !args.has("--target=production") ||
    process.env.NODE_ENV !== "production" ||
    process.env.APP_ENV !== "production"
  ) {
    throw new Error("Production target guard failed");
  }
  if (apply && !args.has("--confirm-production-indexes")) {
    throw new Error("Apply requires --confirm-production-indexes");
  }
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required");

  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });
  try {
    const reports = await inspectMealPlanSafetyIndexes();
    const safeReports = reports.map((report) => ({
      collection: report.contract.collection,
      name: report.contract.name,
      unique: Boolean(report.contract.options.unique),
      duplicateGroupCount: report.duplicateGroupCount,
      status: report.status,
    }));
    if (
      reports.some(
        (report) =>
          report.duplicateGroupCount > 0 || report.status === "name_conflict",
      )
    ) {
      console.log(JSON.stringify({ mode: "preflight", success: false, indexes: safeReports }, null, 2));
      throw new Error("Index preflight blocked");
    }
    const applied = apply ? await applyMealPlanSafetyIndexes(reports) : [];
    console.log(
      JSON.stringify(
        { mode: apply ? "apply" : "preflight", success: true, indexes: safeReports, applied },
        null,
        2,
      ),
    );
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
