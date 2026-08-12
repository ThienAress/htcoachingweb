import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import mongoose from "mongoose";

import { evaluateBackupReadiness } from "../../../scripts/lib/backup-readiness.mjs";
import {
  assertConnectedMigrationTarget,
  assertMigrationEnvironment,
  getMongoDatabaseName,
} from "../config/migrationSafety.js";
import AiMemory from "../models/AiMemory.js";
import AiMemoryPreference from "../models/AiMemoryPreference.js";

const CONFIRMATION_VARIABLE = "CONFIRM_AI_MEMORY_INDEX_MIGRATION";
const BACKUP_MANIFEST_URL = new URL(
  "../../../docs/operations/production/backup-readiness.json",
  import.meta.url,
);
const TARGET_INDEX_NAMES = new Set([
  "uniq_active_ai_memory_kind",
  "ai_memory_owner_status_updated",
  "ai_memory_expiry_ttl",
  "uniq_ai_memory_preference_user",
]);
const MODELS = [AiMemory, AiMemoryPreference];

const normalizeObject = (value = {}) =>
  Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, String(item)]),
  );

const comparableOptions = (value = {}) => ({
  unique: Boolean(value.unique),
  partialFilterExpression: value.partialFilterExpression || null,
  expireAfterSeconds:
    value.expireAfterSeconds === undefined
      ? null
      : Number(value.expireAfterSeconds),
});

const sameIndexContract = (existing, contract) =>
  JSON.stringify(normalizeObject(existing.key)) ===
    JSON.stringify(normalizeObject(contract.keys)) &&
  JSON.stringify(comparableOptions(existing)) ===
    JSON.stringify(comparableOptions(contract.options));

export const getAiMemoryIndexContracts = () =>
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
  ).sort(
    (left, right) =>
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

export const inspectAiMemoryIndexes = async () => {
  const existingByCollection = new Map();
  const reports = [];
  for (const contract of getAiMemoryIndexContracts()) {
    if (!existingByCollection.has(contract.collection)) {
      existingByCollection.set(
        contract.collection,
        await listIndexes(contract.model.collection),
      );
    }
    const existing = existingByCollection.get(contract.collection);
    const sameName = existing.find(({ name }) => name === contract.name);
    const equivalent = existing.find((index) =>
      sameIndexContract(index, contract),
    );
    reports.push({
      contract,
      duplicateGroupCount: await countDuplicateGroups(contract),
      status: equivalent ? "present" : sameName ? "name_conflict" : "missing",
    });
  }
  if (reports.length !== TARGET_INDEX_NAMES.size) {
    throw new Error("AI Memory index contract manifest is incomplete");
  }
  return reports;
};

export const applyAiMemoryIndexes = async (reports) => {
  const blocked = reports.filter(
    (report) =>
      report.duplicateGroupCount > 0 || report.status === "name_conflict",
  );
  if (blocked.length > 0) {
    throw new Error("AI Memory index apply blocked by preflight findings");
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

export const assertCurrentReleaseBackup = ({ manifest, env = process.env }) => {
  const readiness = evaluateBackupReadiness(manifest);
  if (!readiness.releaseReady) {
    throw new Error("AI Memory index apply requires a release-ready backup");
  }
  if (
    String(env.MIGRATION_BACKUP_SNAPSHOT_ID || "").trim() !==
    readiness.backupId
  ) {
    throw new Error("AI Memory index backup ID does not match current evidence");
  }
  return readiness;
};

const safeReports = (reports) =>
  reports.map((report) => ({
    collection: report.contract.collection,
    name: report.contract.name,
    unique: Boolean(report.contract.options.unique),
    ttl: report.contract.options.expireAfterSeconds === 0,
    duplicateGroupCount: report.duplicateGroupCount,
    status: report.status,
  }));

const authorizeTarget = async ({ args, apply }) => {
  const targetArgument = [...args].find((argument) =>
    argument.startsWith("--target="),
  );
  const target = targetArgument?.slice("--target=".length);
  if (!new Set(["staging", "production"]).has(target)) {
    throw new Error("Use an explicit --target=staging or --target=production");
  }
  if (process.env.APP_ENV !== target) {
    throw new Error("AI Memory index target does not match APP_ENV");
  }
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required");

  const uriDatabase = getMongoDatabaseName(process.env.MONGO_URI);
  const targetDatabase = String(
    process.env.MIGRATION_TARGET_DATABASE || "",
  ).trim();
  if (!uriDatabase || !targetDatabase || uriDatabase !== targetDatabase) {
    throw new Error("AI Memory index database target lock failed");
  }

  if (!apply) return { targetDatabase, valid: true };
  if (!args.has("--confirm-ai-memory-indexes")) {
    throw new Error("Apply requires --confirm-ai-memory-indexes");
  }
  const authorization = assertMigrationEnvironment({
    confirmationVariable: CONFIRMATION_VARIABLE,
  });
  if (target === "production") {
    const manifest = JSON.parse(await readFile(BACKUP_MANIFEST_URL, "utf8"));
    assertCurrentReleaseBackup({ manifest });
  }
  return authorization;
};

const main = async () => {
  const args = new Set(process.argv.slice(2));
  const apply = args.has("--apply");
  const authorization = await authorizeTarget({ args, apply });

  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });
  try {
    assertConnectedMigrationTarget(mongoose.connection, authorization);
    const reports = await inspectAiMemoryIndexes();
    const blocked = reports.filter(
      (report) =>
        report.duplicateGroupCount > 0 || report.status === "name_conflict",
    );
    if (blocked.length > 0) {
      console.log(
        JSON.stringify(
          { mode: "preflight", success: false, indexes: safeReports(reports) },
          null,
          2,
        ),
      );
      throw new Error("AI Memory index preflight blocked");
    }

    const applied = apply ? await applyAiMemoryIndexes(reports) : [];
    const verification = apply ? await inspectAiMemoryIndexes() : reports;
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
    if (!success && apply) throw new Error("AI Memory index verification failed");
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
