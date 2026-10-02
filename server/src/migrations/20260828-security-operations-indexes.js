import { pathToFileURL } from "node:url";

import mongoose from "mongoose";

import {
  assertConnectedMigrationTarget,
  assertMigrationEnvironment,
  getMongoDatabaseName,
} from "../config/migrationSafety.js";
import AccountDeletionMediaJob from "../models/AccountDeletionMediaJob.js";
import AccountDeletionRecord from "../models/AccountDeletionRecord.js";
import PracticeEmailDelivery from "../models/PracticeEmailDelivery.js";
import TrainerTransfer from "../models/TrainerTransfer.js";

const CONFIRMATION_VARIABLE = "CONFIRM_SECURITY_OPERATIONS_INDEX_MIGRATION";
const TARGET_INDEX_NAMES = new Set([
  "uniq_trainer_transfer_request",
  "trainer_transfer_client_created",
  "trainer_transfer_from_created",
  "trainer_transfer_to_created",
  "uniq_account_deletion_record",
  "account_deletion_actor_created",
  "uniq_account_deletion_media_asset",
  "account_deletion_media_status_retry",
  "uniq_practice_email_delivery_request",
  "practice_email_delivery_claim",
]);
const MODELS = [
  TrainerTransfer,
  AccountDeletionRecord,
  AccountDeletionMediaJob,
  PracticeEmailDelivery,
];

const normalizeObject = (value = {}) =>
  Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, String(item)]),
  );

const sameContract = (existing, contract) =>
  JSON.stringify(normalizeObject(existing.key)) ===
    JSON.stringify(normalizeObject(contract.keys)) &&
  Boolean(existing.unique) === Boolean(contract.options.unique);

export const getSecurityOperationsIndexContracts = () =>
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
  try {
    const [result] = await contract.model.collection
      .aggregate([
        {
          $group: {
            _id: Object.keys(contract.keys).map((field) => `$${field}`),
            count: { $sum: 1 },
          },
        },
        { $match: { count: { $gt: 1 } } },
        { $count: "count" },
      ])
      .toArray();
    return result?.count || 0;
  } catch (error) {
    if (isMissingNamespace(error)) return 0;
    throw error;
  }
};

export const inspectSecurityOperationsIndexes = async () => {
  const existingByCollection = new Map();
  const reports = [];
  for (const contract of getSecurityOperationsIndexContracts()) {
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
    throw new Error("Security operations index contract manifest is incomplete");
  }
  return reports;
};

export const applySecurityOperationsIndexes = async (reports) => {
  if (
    reports.some(
      ({ duplicateGroupCount, status }) =>
        duplicateGroupCount > 0 || status === "name_conflict",
    )
  ) {
    throw new Error("Security operations index apply blocked by preflight findings");
  }

  const applied = [];
  for (const { contract, status } of reports) {
    if (status === "present") {
      applied.push({ name: contract.name, status: "unchanged" });
      continue;
    }
    const name = await contract.model.collection.createIndex(
      contract.keys,
      contract.options,
    );
    applied.push({ name, status: "created" });
  }
  return applied;
};

export const authorizeSecurityOperationsIndexTarget = ({
  args,
  apply,
  env = process.env,
}) => {
  const target = [...args]
    .find((argument) => argument.startsWith("--target="))
    ?.slice("--target=".length);
  if (!new Set(["staging", "production"]).has(target)) {
    throw new Error("Use an explicit --target=staging or --target=production");
  }
  if (env.APP_ENV !== target) {
    throw new Error("Security operations index target does not match APP_ENV");
  }
  if (!env.MONGO_URI) throw new Error("MONGO_URI is required");

  const uriDatabase = getMongoDatabaseName(env.MONGO_URI);
  const targetDatabase = String(env.MIGRATION_TARGET_DATABASE || "").trim();
  if (!uriDatabase || !targetDatabase || uriDatabase !== targetDatabase) {
    throw new Error("Security operations index database target lock failed");
  }
  if (!apply) return { targetDatabase, valid: true };
  if (!args.has("--confirm-security-operations-indexes")) {
    throw new Error("Apply requires --confirm-security-operations-indexes");
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
  const authorization = authorizeSecurityOperationsIndexTarget({ args, apply });
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });
  try {
    assertConnectedMigrationTarget(mongoose.connection, authorization);
    const reports = await inspectSecurityOperationsIndexes();
    const blocked = reports.some(
      ({ duplicateGroupCount, status }) =>
        duplicateGroupCount > 0 || status === "name_conflict",
    );
    if (blocked) throw new Error("Security operations index preflight blocked");

    const applied = apply ? await applySecurityOperationsIndexes(reports) : [];
    const verification = apply
      ? await inspectSecurityOperationsIndexes()
      : reports;
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
    if (!success) throw new Error("Security operations index verification failed");
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
