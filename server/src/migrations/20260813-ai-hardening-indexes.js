import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import mongoose from "mongoose";

import { evaluateBackupReadiness } from "../../../scripts/lib/backup-readiness.mjs";
import {
  assertConnectedMigrationTarget,
  assertMigrationEnvironment,
  getMongoDatabaseName,
} from "../config/migrationSafety.js";
import AiToolConfirmation from "../models/AiToolConfirmation.js";
import ServiceUsageBucket from "../models/ServiceUsageBucket.js";

const CONFIRMATION_VARIABLE = "CONFIRM_AI_HARDENING_INDEX_MIGRATION";
const BACKUP_MANIFEST_URL = new URL(
  "../../../docs/operations/production/backup-readiness.json",
  import.meta.url,
);
const TARGET_INDEX_NAMES = new Set([
  "service_usage_expiry_ttl",
  "service_usage_user_service",
  "service_usage_guest_service",
  "ai_tool_confirmation_owner_state",
  "ai_tool_confirmation_expiry_ttl",
]);
const MODELS = [ServiceUsageBucket, AiToolConfirmation];

const normalizeObject = (value = {}) =>
  Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, String(item)]),
  );

const comparableOptions = (value = {}) => ({
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

export const getAiHardeningIndexContracts = () =>
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

export const inspectAiHardeningIndexes = async () => {
  const existingByCollection = new Map();
  const reports = [];
  for (const contract of getAiHardeningIndexContracts()) {
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
      status: equivalent ? "present" : sameName ? "name_conflict" : "missing",
    });
  }
  if (reports.length !== TARGET_INDEX_NAMES.size) {
    throw new Error("AI hardening index contract manifest is incomplete");
  }
  return reports;
};

export const applyAiHardeningIndexes = async (reports) => {
  if (reports.some(({ status }) => status === "name_conflict")) {
    throw new Error("AI hardening index apply blocked by preflight findings");
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
    throw new Error("AI hardening index apply requires a release-ready backup");
  }
  if (
    String(env.MIGRATION_BACKUP_SNAPSHOT_ID || "").trim() !== readiness.backupId
  ) {
    throw new Error("AI hardening index backup ID does not match current evidence");
  }
  return readiness;
};

const safeReports = (reports) =>
  reports.map(({ contract, status }) => ({
    collection: contract.collection,
    name: contract.name,
    ttl: contract.options.expireAfterSeconds === 0,
    status,
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
    throw new Error("AI hardening index target does not match APP_ENV");
  }
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required");
  const uriDatabase = getMongoDatabaseName(process.env.MONGO_URI);
  const targetDatabase = String(
    process.env.MIGRATION_TARGET_DATABASE || "",
  ).trim();
  if (!uriDatabase || !targetDatabase || uriDatabase !== targetDatabase) {
    throw new Error("AI hardening index database target lock failed");
  }
  if (!apply) return { targetDatabase, valid: true };
  if (!args.has("--confirm-ai-hardening-indexes")) {
    throw new Error("Apply requires --confirm-ai-hardening-indexes");
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
    const reports = await inspectAiHardeningIndexes();
    if (reports.some(({ status }) => status === "name_conflict")) {
      console.log(
        JSON.stringify(
          { mode: "preflight", success: false, indexes: safeReports(reports) },
          null,
          2,
        ),
      );
      throw new Error("AI hardening index preflight blocked");
    }
    const applied = apply ? await applyAiHardeningIndexes(reports) : [];
    const verification = apply ? await inspectAiHardeningIndexes() : reports;
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
    if (!success && apply) {
      throw new Error("AI hardening index verification failed");
    }
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
