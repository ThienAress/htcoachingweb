import { readFileSync } from "node:fs";

import { evaluateBackupReadiness } from "../../../scripts/lib/backup-readiness.mjs";
import { getMongoDatabaseName } from "../config/migrationSafety.js";

const STAGING_DATABASE = "htcoaching_staging";
const DIGEST_PATTERN = /^[a-f0-9]{64}$/;
const DEFAULT_PROVIDER_CALL_LIMIT = 500;
const MAX_PROVIDER_CALL_LIMIT = 5000;
const BACKUP_MANIFEST_URL = new URL(
  "../../../docs/operations/production/backup-readiness.json",
  import.meta.url,
);

const fail = (errors) => {
  const error = new Error(`KB re-embed rejected: ${errors.join(", ")}`);
  error.code = "KB_REEMBED_AUTHORIZATION_REJECTED";
  error.findings = errors;
  throw error;
};

const parseArgs = (argv) => {
  const values = {};
  for (const item of argv) {
    if (!item.startsWith("--")) continue;
    const [rawKey, ...rest] = item.slice(2).split("=");
    values[rawKey] = rest.length > 0 ? rest.join("=") : true;
  }
  return values;
};

export const validateStagingKnowledgeBaseReembedAuthorization = ({
  argv = process.argv.slice(2),
  env = process.env,
} = {}) => {
  const args = parseArgs(argv);
  const errors = [];
  const add = (code) => {
    if (!errors.includes(code)) errors.push(code);
  };
  const target = String(args.target || "").trim().toLowerCase();
  const operation = args.rollback ? "rollback" : "reembed";
  const apply = args.apply === true;
  const appEnvironment = String(env.APP_ENV || "").trim().toLowerCase();
  const targetDatabase = String(env.MIGRATION_TARGET_DATABASE || "").trim();
  const uriDatabase = getMongoDatabaseName(env.MONGO_URI);
  const reviewedPlanDigest = String(args["plan-digest"] || "").trim();
  const snapshotDirectory = String(
    args["snapshot-dir"] || env.KB_REEMBED_SNAPSHOT_DIR || "",
  ).trim();
  const snapshotFile = String(args.snapshot || "").trim();
  const snapshotSecret = String(env.KB_REEMBED_SNAPSHOT_KEY || "");
  const rawProviderCallLimit = String(
    env.KB_REEMBED_MAX_PROVIDER_CALLS || DEFAULT_PROVIDER_CALL_LIMIT,
  ).trim();
  const maxProviderCalls = Number(rawProviderCallLimit);

  if (target !== "staging") add("KB_REEMBED_STAGING_TARGET_REQUIRED");
  if (appEnvironment !== "staging") add("KB_REEMBED_STAGING_APP_ENV_REQUIRED");
  if (!uriDatabase) add("KB_REEMBED_URI_DATABASE_REQUIRED");
  if (targetDatabase !== STAGING_DATABASE) {
    add("KB_REEMBED_TARGET_DATABASE_REQUIRED");
  }
  if (uriDatabase && uriDatabase !== STAGING_DATABASE) {
    add("KB_REEMBED_STAGING_DATABASE_REQUIRED");
  }
  if (uriDatabase && targetDatabase && uriDatabase !== targetDatabase) {
    add("KB_REEMBED_TARGET_DATABASE_MISMATCH");
  }

  if (apply) {
    const confirmation =
      operation === "rollback"
        ? env.CONFIRM_KB_REEMBED_ROLLBACK_STAGING
        : env.CONFIRM_KB_REEMBED_STAGING;
    if (String(confirmation || "").trim().toLowerCase() !== "yes") {
      add(
        operation === "rollback"
          ? "KB_REEMBED_ROLLBACK_STAGING_CONFIRMATION_REQUIRED"
          : "KB_REEMBED_STAGING_CONFIRMATION_REQUIRED",
      );
    }
    if (!DIGEST_PATTERN.test(reviewedPlanDigest)) {
      add("KB_REEMBED_PLAN_DIGEST_REQUIRED");
    }
  }

  if (operation === "reembed" && apply && !snapshotDirectory) {
    add("KB_REEMBED_SNAPSHOT_DIR_REQUIRED");
  }
  if (operation === "rollback" && !snapshotFile) {
    add("KB_REEMBED_SNAPSHOT_FILE_REQUIRED");
  }
  if ((apply || operation === "rollback") && snapshotSecret.length < 32) {
    add("KB_REEMBED_SNAPSHOT_KEY_REQUIRED");
  }
  if (
    !Number.isSafeInteger(maxProviderCalls) ||
    maxProviderCalls < 1 ||
    maxProviderCalls > MAX_PROVIDER_CALL_LIMIT
  ) {
    add("KB_REEMBED_PROVIDER_CALL_LIMIT_INVALID");
  }

  if (errors.length > 0) fail(errors);
  return {
    valid: true,
    target,
    operation,
    apply,
    appEnvironment,
    targetDatabase,
    reviewedPlanDigest,
    snapshotDirectory,
    snapshotFile,
    snapshotSecret,
    maxProviderCalls,
  };
};

export const assertKnowledgeReembedConnectedTarget = (
  connection,
  authorization,
) => {
  const connectedDatabase = String(
    connection?.name || connection?.db?.databaseName || "",
  ).trim();
  if (
    !authorization?.valid ||
    authorization.targetDatabase !== STAGING_DATABASE ||
    connectedDatabase !== STAGING_DATABASE
  ) {
    const error = new Error(
      "KB_REEMBED_CONNECTED_DATABASE_MISMATCH: expected htcoaching_staging",
    );
    error.code = "KB_REEMBED_CONNECTED_DATABASE_MISMATCH";
    throw error;
  }
  return authorization;
};

export const assertStagingKnowledgeBackupReady = ({
  now = new Date(),
  backupManifest,
} = {}) => {
  let readiness;
  try {
    const manifest = backupManifest === undefined
      ? JSON.parse(readFileSync(BACKUP_MANIFEST_URL, "utf8"))
      : backupManifest;
    readiness = evaluateBackupReadiness(manifest, { now });
  } catch {
    const error = new Error("KB_REEMBED_BACKUP_MANIFEST_INVALID");
    error.code = "KB_REEMBED_BACKUP_MANIFEST_INVALID";
    throw error;
  }
  if (!readiness.disasterRecoveryReady) {
    const error = new Error("KB_REEMBED_FRESH_OFF_DEVICE_BACKUP_REQUIRED");
    error.code = "KB_REEMBED_FRESH_OFF_DEVICE_BACKUP_REQUIRED";
    throw error;
  }
  return { backupId: readiness.backupId, ready: true };
};
