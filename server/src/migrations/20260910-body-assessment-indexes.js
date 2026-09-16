import { pathToFileURL } from "node:url";

import mongoose from "mongoose";

import {
  assertConnectedMigrationTarget,
  assertMigrationEnvironment,
  getMongoDatabaseName,
} from "../config/migrationSafety.js";
import BodyAssessment from "../models/BodyAssessment.js";
import BodyAssessmentCommand from "../models/BodyAssessmentCommand.js";
import BodyAssessmentRevision from "../models/BodyAssessmentRevision.js";
import { isMongoIndexContractEquivalent } from "../utils/mongoIndexContract.js";

const CONFIRMATION_VARIABLE = "CONFIRM_BODY_ASSESSMENT_INDEX_MIGRATION";
const TARGET_INDEX_NAMES = new Set([
  "uniq_body_assessment_period",
  "body_assessment_published_history",
  "body_assessment_retention_candidates",
  "uniq_body_assessment_command",
  "body_assessment_client_receipts",
  "uniq_body_assessment_revision",
  "body_assessment_client_history",
]);
const MODELS = [BodyAssessment, BodyAssessmentCommand, BodyAssessmentRevision];

export const getBodyAssessmentIndexContracts = () =>
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
            _id: Object.fromEntries(
              Object.keys(contract.keys).map((field) => [field, `$${field}`]),
            ),
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

export const inspectBodyAssessmentIndexes = async () => {
  const existingByCollection = new Map();
  const reports = [];
  for (const contract of getBodyAssessmentIndexContracts()) {
    if (!existingByCollection.has(contract.collection)) {
      existingByCollection.set(
        contract.collection,
        await listIndexes(contract.model.collection),
      );
    }
    const existing = existingByCollection.get(contract.collection);
    const sameName = existing.find(({ name }) => name === contract.name);
    const equivalent = existing.find((index) =>
      isMongoIndexContractEquivalent(index, contract),
    );
    reports.push({
      contract,
      duplicateGroupCount: await countDuplicateGroups(contract),
      status: equivalent ? "present" : sameName ? "name_conflict" : "missing",
    });
  }
  if (reports.length !== TARGET_INDEX_NAMES.size) {
    throw new Error("Body assessment index contract manifest is incomplete");
  }
  return reports;
};

export const applyBodyAssessmentIndexes = async (reports) => {
  if (
    reports.some(
      ({ duplicateGroupCount, status }) =>
        duplicateGroupCount > 0 || status === "name_conflict",
    )
  ) {
    throw new Error("Body assessment index apply blocked by preflight findings");
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

export const authorizeBodyAssessmentIndexTarget = ({
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
    throw new Error("Body assessment index target does not match APP_ENV");
  }
  if (!env.MONGO_URI) throw new Error("MONGO_URI is required");

  const uriDatabase = getMongoDatabaseName(env.MONGO_URI);
  const targetDatabase = String(env.MIGRATION_TARGET_DATABASE || "").trim();
  if (!uriDatabase || !targetDatabase || uriDatabase !== targetDatabase) {
    throw new Error("Body assessment index database target lock failed");
  }
  if (!apply) return { targetDatabase, valid: true };
  if (!args.has("--confirm-body-assessment-indexes")) {
    throw new Error("Apply requires --confirm-body-assessment-indexes");
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
  const authorization = authorizeBodyAssessmentIndexTarget({ args, apply });
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });
  try {
    assertConnectedMigrationTarget(mongoose.connection, authorization);
    const reports = await inspectBodyAssessmentIndexes();
    const blocked = reports.some(
      ({ duplicateGroupCount, status }) =>
        duplicateGroupCount > 0 || status === "name_conflict",
    );
    if (blocked) throw new Error("Body assessment index preflight blocked");

    const applied = apply ? await applyBodyAssessmentIndexes(reports) : [];
    const verification = apply ? await inspectBodyAssessmentIndexes() : reports;
    const success = !apply || verification.every(({ status }) => status === "present");
    process.stdout.write(
      `${JSON.stringify({ mode: apply ? "apply" : "preflight", success, indexes: safeReports(verification), applied }, null, 2)}\n`,
    );
    if (!success) throw new Error("Body assessment index verification failed");
  } finally {
    await mongoose.disconnect();
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
