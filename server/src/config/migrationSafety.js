const ALLOWED_ENVIRONMENTS = new Set(["staging", "production"]);
const STAGING_DATABASE = "htcoaching_staging";
const PLACEHOLDER_PATTERN =
  /^(?:changeme|example|none|pending|replace[-_ ]?me|todo)$/i;

export const getMongoDatabaseName = (value) => {
  try {
    return decodeURIComponent(new URL(String(value || "")).pathname)
      .replace(/^\/+/, "")
      .split("/")[0]
      .trim();
  } catch {
    return "";
  }
};

const hasRecordedValue = (value) => {
  const normalized = String(value || "").trim();
  return normalized.length >= 8 && !PLACEHOLDER_PATTERN.test(normalized);
};

export const validateMigrationEnvironment = ({
  env = process.env,
  confirmationVariable,
} = {}) => {
  const errors = [];
  const addError = (code) => {
    if (!errors.includes(code)) errors.push(code);
  };
  const appEnvironment = String(env.APP_ENV || "").trim().toLowerCase();
  const uriDatabase = getMongoDatabaseName(env.MONGO_URI);
  const targetDatabase = String(env.MIGRATION_TARGET_DATABASE || "").trim();

  if (!ALLOWED_ENVIRONMENTS.has(appEnvironment)) {
    addError("MIGRATION_APP_ENV_REQUIRED");
  }
  if (!uriDatabase) addError("MIGRATION_URI_DATABASE_REQUIRED");
  if (!targetDatabase) addError("MIGRATION_TARGET_DATABASE_REQUIRED");
  if (uriDatabase && targetDatabase && uriDatabase !== targetDatabase) {
    addError("MIGRATION_TARGET_DATABASE_MISMATCH");
  }
  if (
    !confirmationVariable ||
    String(env[confirmationVariable] || "").trim().toLowerCase() !== "yes"
  ) {
    addError("MIGRATION_PHASE_CONFIRMATION_REQUIRED");
  }

  if (appEnvironment === "staging" && uriDatabase !== STAGING_DATABASE) {
    addError("MIGRATION_STAGING_DATABASE_REQUIRED");
  }

  if (appEnvironment === "production") {
    if (uriDatabase === STAGING_DATABASE) {
      addError("MIGRATION_PRODUCTION_DATABASE_REQUIRED");
    }
    if (String(env.CONFIRM_PRODUCTION_MIGRATION || "").trim() !== "production") {
      addError("MIGRATION_PRODUCTION_CONFIRMATION_REQUIRED");
    }
    if (!hasRecordedValue(env.MIGRATION_BACKUP_SNAPSHOT_ID)) {
      addError("MIGRATION_BACKUP_SNAPSHOT_REQUIRED");
    }
    if (!hasRecordedValue(env.MIGRATION_APPROVAL_ID)) {
      addError("MIGRATION_APPROVAL_REQUIRED");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    appEnvironment,
    targetDatabase,
  };
};

export const assertMigrationEnvironment = (options) => {
  const result = validateMigrationEnvironment(options);
  if (!result.valid) {
    const error = new Error(`Migration rejected: ${result.errors.join(", ")}`);
    error.code = "MIGRATION_ENVIRONMENT_REJECTED";
    error.findings = result.errors;
    throw error;
  }
  return result;
};

export const assertConnectedMigrationTarget = (connection, authorization) => {
  const connectedDatabase = String(connection?.db?.databaseName || "").trim();
  const expectedDatabase = String(authorization?.targetDatabase || "").trim();

  if (!authorization?.valid || !expectedDatabase) {
    const error = new Error(
      "Migration rejected: MIGRATION_AUTHORIZATION_REQUIRED",
    );
    error.code = "MIGRATION_AUTHORIZATION_REQUIRED";
    throw error;
  }
  if (!connectedDatabase || connectedDatabase !== expectedDatabase) {
    const error = new Error(
      "Migration rejected: MIGRATION_CONNECTED_DATABASE_MISMATCH",
    );
    error.code = "MIGRATION_CONNECTED_DATABASE_MISMATCH";
    throw error;
  }
  return authorization;
};
