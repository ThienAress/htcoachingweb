import { pathToFileURL } from "node:url";

import mongoose from "mongoose";

import AnalyticsSyncState from "../models/AnalyticsSyncState.js";
import F1Customer from "../models/F1Customer.js";
import Order from "../models/Order.js";
import SeoDailyMetric from "../models/SeoDailyMetric.js";

const TARGET_INDEX_NAMES = new Set([
  "uniq_f1_conversion_originBookingId",
  "uniq_f1_conversion_originContactMessageId",
  "uniq_order_conversion_originBookingId",
  "uniq_order_conversion_originContactMessageId",
  "uniq_seo_daily_metric",
  "seo_date_dimension",
  "seo_dimension_key_date",
  "uniq_analytics_sync_provider",
  "analytics_sync_status_lock",
]);

const MODELS = [F1Customer, Order, SeoDailyMetric, AnalyticsSyncState];

const normalizedEntries = (value = {}) =>
  Object.entries(value).map(([key, item]) => [key, String(item)]);

const sameIndexContract = (existing, contract) =>
  JSON.stringify(normalizedEntries(existing.key)) ===
    JSON.stringify(normalizedEntries(contract.keys)) &&
  Boolean(existing.unique) === Boolean(contract.options.unique) &&
  JSON.stringify(existing.partialFilterExpression || null) ===
    JSON.stringify(contract.options.partialFilterExpression || null);

export const getSeoConversionIndexContracts = () =>
  MODELS.flatMap((model) =>
    model.schema.indexes()
      .filter(([, options]) => TARGET_INDEX_NAMES.has(options.name))
      .map(([keys, options]) => ({
        model,
        collection: model.collection.name,
        name: options.name,
        keys,
        options,
      })),
  ).sort((left, right) =>
    [...TARGET_INDEX_NAMES].indexOf(left.name) -
    [...TARGET_INDEX_NAMES].indexOf(right.name),
  );

const listIndexes = async (collection) => {
  try {
    return await collection.listIndexes().toArray();
  } catch (error) {
    if (error?.code === 26 || error?.codeName === "NamespaceNotFound") return [];
    throw error;
  }
};

const countDuplicateGroups = async (contract) => {
  if (!contract.options.unique) return 0;
  const groupId = Object.fromEntries(
    Object.keys(contract.keys).map((field) => [field, `$${field}`]),
  );
  const pipeline = [];
  if (contract.options.partialFilterExpression) {
    pipeline.push({ $match: contract.options.partialFilterExpression });
  }
  pipeline.push(
    { $group: { _id: groupId, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $count: "count" },
  );
  const [result] = await contract.model.collection.aggregate(pipeline).toArray();
  return result?.count || 0;
};

export const inspectSeoConversionIndexes = async () => {
  const reports = [];
  for (const contract of getSeoConversionIndexContracts()) {
    const existingIndexes = await listIndexes(contract.model.collection);
    const sameName = existingIndexes.find(({ name }) => name === contract.name);
    const equivalent = existingIndexes.find((index) =>
      sameIndexContract(index, contract),
    );
    reports.push({
      contract,
      duplicateGroupCount: await countDuplicateGroups(contract),
      status: equivalent
        ? "present"
        : sameName
          ? "name_conflict"
          : "missing",
    });
  }
  return reports;
};

export const applySeoConversionIndexes = async (reports) => {
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

const safeReport = (reports) => reports.map((report) => ({
  collection: report.contract.collection,
  name: report.contract.name,
  unique: Boolean(report.contract.options.unique),
  duplicateGroupCount: report.duplicateGroupCount,
  status: report.status,
}));

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
    const reports = await inspectSeoConversionIndexes();
    const blocked = reports.filter((report) =>
      report.duplicateGroupCount > 0 || report.status === "name_conflict",
    );
    if (blocked.length > 0) {
      console.log(JSON.stringify({
        mode: "preflight",
        success: false,
        indexes: safeReport(reports),
      }, null, 2));
      throw new Error("Index preflight blocked");
    }

    const applied = apply
      ? await applySeoConversionIndexes(reports)
      : [];
    console.log(JSON.stringify({
      mode: apply ? "apply" : "preflight",
      success: true,
      indexes: safeReport(reports),
      applied,
    }, null, 2));
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
