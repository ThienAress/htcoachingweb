import { pathToFileURL } from "node:url";

import mongoose from "mongoose";

import {
  assertConnectedMigrationTarget,
  assertMigrationEnvironment,
  getMongoDatabaseName,
} from "../config/migrationSafety.js";
import IncomingBankTransaction from "../models/IncomingBankTransaction.js";
import ProviderSyncCursor from "../models/ProviderSyncCursor.js";

const CONFIRMATION_VARIABLE = "CONFIRM_SEPAY_WALLET_INDEX_MIGRATION";
const TARGET_INDEX_NAMES = new Set([
  "uniq_incoming_provider_source_transaction",
  "uniq_incoming_provider_bank_reference",
  "incoming_status_created",
  "incoming_deposit_transaction_at",
  "incoming_user_transaction_at",
  "uniq_provider_sync_cursor_account",
  "provider_sync_cursor_lease_expiry",
]);
const MODELS = [IncomingBankTransaction, ProviderSyncCursor];

const normalizeObject = (value = {}) =>
  Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, String(item)]),
  );

const comparableOptions = (value = {}) => ({
  unique: Boolean(value.unique),
  partialFilterExpression: value.partialFilterExpression || null,
});

const sameContract = (existing, contract) =>
  JSON.stringify(normalizeObject(existing.key)) ===
    JSON.stringify(normalizeObject(contract.keys)) &&
  JSON.stringify(comparableOptions(existing)) ===
    JSON.stringify(comparableOptions(contract.options));

export const getSePayWalletIndexContracts = () =>
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
  const [result] = await contract.model.collection.aggregate(pipeline).toArray();
  return result?.count || 0;
};

export const inspectSePayWalletIndexes = async () => {
  const existingByCollection = new Map();
  const reports = [];
  for (const contract of getSePayWalletIndexContracts()) {
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
    throw new Error("SePay wallet index contract manifest is incomplete");
  }
  return reports;
};

export const applySePayWalletIndexes = async (reports) => {
  if (
    reports.some(
      ({ duplicateGroupCount, status }) =>
        duplicateGroupCount > 0 || status === "name_conflict",
    )
  ) {
    throw new Error("SePay wallet index apply blocked by preflight findings");
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

const authorizeTarget = ({ args, apply }) => {
  const targetArgument = [...args].find((argument) =>
    argument.startsWith("--target="),
  );
  const target = targetArgument?.slice("--target=".length);
  if (!new Set(["staging", "production"]).has(target)) {
    throw new Error("Use an explicit --target=staging or --target=production");
  }
  if (process.env.APP_ENV !== target) {
    throw new Error("SePay wallet index target does not match APP_ENV");
  }
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required");
  const uriDatabase = getMongoDatabaseName(process.env.MONGO_URI);
  const targetDatabase = String(
    process.env.MIGRATION_TARGET_DATABASE || "",
  ).trim();
  if (!uriDatabase || !targetDatabase || uriDatabase !== targetDatabase) {
    throw new Error("SePay wallet index database target lock failed");
  }
  if (!apply) return { targetDatabase, valid: true };
  if (!args.has("--confirm-sepay-wallet-indexes")) {
    throw new Error("Apply requires --confirm-sepay-wallet-indexes");
  }
  return assertMigrationEnvironment({
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
  const authorization = authorizeTarget({ args, apply });
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });
  try {
    assertConnectedMigrationTarget(mongoose.connection, authorization);
    const reports = await inspectSePayWalletIndexes();
    const blocked = reports.some(
      ({ duplicateGroupCount, status }) =>
        duplicateGroupCount > 0 || status === "name_conflict",
    );
    if (blocked) throw new Error("SePay wallet index preflight blocked");
    const applied = apply ? await applySePayWalletIndexes(reports) : [];
    const verification = apply ? await inspectSePayWalletIndexes() : reports;
    const success = !apply || verification.every(({ status }) => status === "present");
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
    if (!success) throw new Error("SePay wallet index verification failed");
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
