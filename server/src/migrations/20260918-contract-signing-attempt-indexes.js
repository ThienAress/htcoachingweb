import { pathToFileURL } from "node:url";

import mongoose from "mongoose";

import { resolveMongoConnectionOptions } from "../config/mongoConnectionOptions.js";
import {
  assertConnectedMigrationTarget,
  assertMigrationEnvironment,
  getMongoDatabaseName,
} from "../config/migrationSafety.js";
import ContractSigningAttempt from "../models/ContractSigningAttempt.js";
import { isMongoIndexContractEquivalent } from "../utils/mongoIndexContract.js";

const CONFIRMATION_VARIABLE =
  "CONFIRM_CONTRACT_SIGNING_ATTEMPT_INDEX_MIGRATION";
const TARGET_INDEX_NAMES = new Set([
  "uniq_contract_signing_candidate",
  "contract_signing_recovery_claim",
  "contract_signing_history",
]);

export const getContractSigningAttemptIndexContracts = () =>
  ContractSigningAttempt.schema
    .indexes()
    .filter(([, options]) => TARGET_INDEX_NAMES.has(options.name))
    .map(([keys, options]) => ({
      model: ContractSigningAttempt,
      collection: ContractSigningAttempt.collection.name,
      name: options.name,
      keys,
      options,
    }));

const isMissingNamespace = (error) =>
  error?.code === 26 || error?.codeName === "NamespaceNotFound";

const listIndexes = async () => {
  try {
    return await ContractSigningAttempt.collection.listIndexes().toArray();
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

export const inspectContractSigningAttemptIndexes = async () => {
  const contracts = getContractSigningAttemptIndexContracts();
  if (contracts.length !== TARGET_INDEX_NAMES.size) {
    throw new Error("Contract signing-attempt index manifest is incomplete");
  }

  const existing = await listIndexes();
  return Promise.all(
    contracts.map(async (contract) => {
      const sameName = existing.find(({ name }) => name === contract.name);
      const equivalent = existing.find((index) =>
        isMongoIndexContractEquivalent(index, contract),
      );
      return {
        contract,
        duplicateGroupCount: await countDuplicateGroups(contract),
        status: equivalent ? "present" : sameName ? "name_conflict" : "missing",
      };
    }),
  );
};

export const applyContractSigningAttemptIndexes = async (reports) => {
  if (
    reports.some(
      ({ duplicateGroupCount, status }) =>
        duplicateGroupCount > 0 || status === "name_conflict",
    )
  ) {
    throw new Error(
      "Contract signing-attempt index apply blocked by preflight findings",
    );
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

export const authorizeContractSigningAttemptIndexTarget = ({
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
    throw new Error("Contract signing-attempt index target does not match APP_ENV");
  }
  if (!env.MONGO_URI) throw new Error("MONGO_URI is required");

  const uriDatabase = getMongoDatabaseName(env.MONGO_URI);
  const targetDatabase = String(env.MIGRATION_TARGET_DATABASE || "").trim();
  if (!uriDatabase || !targetDatabase || uriDatabase !== targetDatabase) {
    throw new Error("Contract signing-attempt index database target lock failed");
  }
  if (!apply) return { targetDatabase, valid: true };
  if (!args.has("--confirm-contract-signing-attempt-indexes")) {
    throw new Error(
      "Apply requires --confirm-contract-signing-attempt-indexes",
    );
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
  const authorization = authorizeContractSigningAttemptIndexTarget({
    args,
    apply,
  });
  await mongoose.connect(
    process.env.MONGO_URI,
    resolveMongoConnectionOptions({ durable: true, autoIndex: false }),
  );
  try {
    assertConnectedMigrationTarget(mongoose.connection, authorization);
    const reports = await inspectContractSigningAttemptIndexes();
    const blocked = reports.some(
      ({ duplicateGroupCount, status }) =>
        duplicateGroupCount > 0 || status === "name_conflict",
    );
    if (blocked) {
      throw new Error("Contract signing-attempt index preflight blocked");
    }

    const applied = apply
      ? await applyContractSigningAttemptIndexes(reports)
      : [];
    const verification = apply
      ? await inspectContractSigningAttemptIndexes()
      : reports;
    const success =
      !apply || verification.every(({ status }) => status === "present");
    process.stdout.write(
      `${JSON.stringify(
        {
          mode: apply ? "apply" : "preflight",
          success,
          indexes: safeReports(verification),
          applied,
        },
        null,
        2,
      )}\n`,
    );
    if (!success) {
      throw new Error("Contract signing-attempt index verification failed");
    }
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
