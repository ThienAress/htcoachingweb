import { pathToFileURL } from "node:url";

import mongoose from "mongoose";

import { getMongoDatabaseName } from "../config/migrationSafety.js";
import { verifyContractGridFsRestore } from "../operations/contractGridFsRestoreVerifier.js";

const ISOLATED_DATABASE_PATTERN = /(?:^|[_-])(?:restore|drill|verify)(?:[_-]|$)/iu;

export const validateRestoreTarget = ({ env = process.env } = {}) => {
  const uri = String(env.RESTORE_VERIFY_MONGO_URI || "");
  const uriDatabase = getMongoDatabaseName(uri);
  const targetDatabase = String(env.RESTORE_VERIFY_TARGET_DATABASE || "").trim();
  const productionDatabase = String(
    env.RESTORE_VERIFY_PRODUCTION_DATABASE || "",
  ).trim();
  const errors = [];
  if (!uriDatabase) errors.push("RESTORE_VERIFY_URI_REQUIRED");
  if (!targetDatabase || targetDatabase !== uriDatabase) {
    errors.push("RESTORE_VERIFY_TARGET_MISMATCH");
  }
  if (
    !productionDatabase ||
    targetDatabase === productionDatabase ||
    !ISOLATED_DATABASE_PATTERN.test(targetDatabase)
  ) {
    errors.push("RESTORE_VERIFY_ISOLATION_REQUIRED");
  }
  if (String(env.CONFIRM_ISOLATED_RESTORE || "").toLowerCase() !== "yes") {
    errors.push("RESTORE_VERIFY_CONFIRMATION_REQUIRED");
  }
  return { valid: errors.length === 0, errors, uri, targetDatabase };
};

const main = async () => {
  const target = validateRestoreTarget();
  if (!target.valid) {
    throw new Error(`Restore verification rejected: ${target.errors.join(", ")}`);
  }
  await mongoose.connect(target.uri, { autoIndex: false });
  try {
    if (mongoose.connection.db.databaseName !== target.targetDatabase) {
      throw new Error("Restore verification connected database mismatch");
    }
    const result = await verifyContractGridFsRestore(mongoose.connection.db);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (!result.success) process.exitCode = 1;
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
